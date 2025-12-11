/**
 * Style Dictionary Configuration
 * Transforms W3C DTCG tokens into platform-specific formats
 *
 * Usage:
 *   npx style-dictionary build --config style-dictionary.config.js
 */

import { readdirSync, statSync } from 'fs';
import { join } from 'path';

// Find the most recent .tokens.json file in output directory
function findLatestTokensFile() {
  const outputDir = 'output';
  const domains = readdirSync(outputDir);

  let latestFile = null;
  let latestTime = 0;

  for (const domain of domains) {
    const domainPath = join(outputDir, domain);
    if (!statSync(domainPath).isDirectory()) continue;

    const files = readdirSync(domainPath).filter(f => f.endsWith('.tokens.json'));
    for (const file of files) {
      const filePath = join(domainPath, file);
      const mtime = statSync(filePath).mtimeMs;
      if (mtime > latestTime) {
        latestTime = mtime;
        latestFile = filePath;
      }
    }
  }

  return latestFile || 'output/**/*.tokens.json';
}

export default {
  // Use DTCG parser for W3C Design Tokens format
  parsers: [
    {
      name: 'dtcg',
      pattern: /\.tokens\.json$/
    }
  ],

  // Register custom transforms and formats via hooks
  hooks: {
    formats: {
      // Custom CSS format that handles composite tokens properly
      'css/variables-extended': ({ dictionary }) => {
        const tokens = dictionary.allTokens.map((token) => {
          // Use the transformed value if available, otherwise use original
          let value = token.value !== undefined ? token.value : token.original?.value || token.$value;

          // Typography composite tokens
          if (value && typeof value === 'object' &&
            ('fontFamily' in value || 'fontSize' in value)) {
            const v = value;
            const weight = v.fontWeight?.$value ?? v.fontWeight ?? 400;

            let size = '16px';
            if (v.fontSize?.$value && typeof v.fontSize.$value === 'object') {
              size = `${v.fontSize.$value.value}${v.fontSize.$value.unit}`;
            } else if (typeof v.fontSize === 'object' && v.fontSize.value) {
              size = `${v.fontSize.value}${v.fontSize.unit || 'px'}`;
            }

            const lineHeight = v.lineHeight?.$value ?? v.lineHeight ?? 'normal';
            const family = v.fontFamily || 'sans-serif';
            value = `${weight} ${size}/${lineHeight} ${family}`;
          }
          // Shadow tokens
          else if (value && typeof value === 'object' && 
                   ('offsetX' in value || 'blur' in value)) {
            const v = value;
            const x = `${v.offsetX?.value || 0}${v.offsetX?.unit || 'px'}`;
            const y = `${v.offsetY?.value || 0}${v.offsetY?.unit || 'px'}`;
            const blur = `${v.blur?.value || 0}${v.blur?.unit || 'px'}`;
            const spread = `${v.spread?.value || 0}${v.spread?.unit || 'px'}`;
            const color = v.color?.hex || '#000000';
            value = `${x} ${y} ${blur} ${spread} ${color}`;
          }

          // Skip tokens with undefined values
          if (value === undefined || value === null) {
            return null;
          }

          return `  --${token.name}: ${value};`;
        }).filter(Boolean);  // Remove nulls

        return `/**\n * Do not edit directly, this file was auto-generated.\n */\n\n:root {\n${tokens.join('\n')}\n}\n`;
      }
    },
    transforms: {
      // Extract hex value from DTCG color object
      'dtcg/color/hex': {
        type: 'value',
        filter: (token) => token.$type === 'color',
        transform: (token) => {
          // Handle DTCG color format: { colorSpace, components, hex }
          if (token.$value && typeof token.$value === 'object' && token.$value.hex) {
            return token.$value.hex;
          }
          // Fallback to raw value if not DTCG format
          return token.$value;
        }
      },
      // Extract dimension as string (e.g., "16px")
      'dtcg/dimension/string': {
        type: 'value',
        filter: (token) => token.$type === 'dimension',
        transform: (token) => {
          if (token.$value && typeof token.$value === 'object') {
            return `${token.$value.value}${token.$value.unit}`;
          }
          return token.$value;
        }
      },
      // Convert shadow to CSS box-shadow string
      'dtcg/shadow/css': {
        type: 'value',
        filter: (token) => token.$type === 'shadow',
        transform: (token) => {
          const v = token.$value;
          if (v && typeof v === 'object') {
            const x = `${v.offsetX?.value || 0}${v.offsetX?.unit || 'px'}`;
            const y = `${v.offsetY?.value || 0}${v.offsetY?.unit || 'px'}`;
            const blur = `${v.blur?.value || 0}${v.blur?.unit || 'px'}`;
            const spread = `${v.spread?.value || 0}${v.spread?.unit || 'px'}`;
            const color = v.color?.hex || '#000000';
            return `${x} ${y} ${blur} ${spread} ${color}`;
          }
          return token.$value;
        }
      },
      // Convert typography to CSS shorthand or detailed properties
      'dtcg/typography/css': {
        type: 'value',
        // Filter for typography style tokens by path and structure
        filter: (token) => {
          // Check if path contains typography.style
          const hasTypographyPath = token.path && token.path.some(p => p === 'typography' || p === 'style');
          // Check if value has typography properties
          const v = token.$value || token.value;
          const hasTypographyProps = v && typeof v === 'object' &&
            ('fontFamily' in v || 'fontSize' in v || 'fontWeight' in v);
          return (token.$type === 'typography') || (hasTypographyPath && hasTypographyProps);
        },
        transform: (token) => {
          // Handle both token.$value and token.value
          const v = token.$value || token.value;
          if (v && typeof v === 'object' && ('fontFamily' in v || 'fontSize' in v)) {
            // Extract fontWeight (may be nested DTCG token)
            const weight = v.fontWeight?.$value ?? v.fontWeight ?? 400;

            // Extract fontSize (nested DTCG dimension token)
            let size = '16px';
            if (v.fontSize?.$value && typeof v.fontSize.$value === 'object') {
              size = `${v.fontSize.$value.value}${v.fontSize.$value.unit}`;
            } else if (v.fontSize?.$value) {
              size = String(v.fontSize.$value);
            } else if (typeof v.fontSize === 'string') {
              size = v.fontSize;
            } else if (typeof v.fontSize === 'object' && v.fontSize.value) {
              size = `${v.fontSize.value}${v.fontSize.unit || 'px'}`;
            }

            // Extract lineHeight (may be nested DTCG number token)
            const lineHeight = v.lineHeight?.$value ?? v.lineHeight ?? 'normal';

            // Extract fontFamily (already resolved by DTCG parser)
            const family = v.fontFamily || 'sans-serif';

            return `${weight} ${size}/${lineHeight} ${family}`;
          }
          // If we got here, something's wrong - return original value
          return token.value || token.$value;
        }
      }
    },
    transformGroups: {
      'dtcg/css': [
        'dtcg/color/hex',
        'dtcg/dimension/string',
        'dtcg/shadow/css',
        'dtcg/typography/css',
        'name/kebab'
      ],
      'dtcg/scss': [
        'dtcg/color/hex',
        'dtcg/dimension/string',
        'dtcg/shadow/css',
        'dtcg/typography/css',
        'name/kebab'
      ],
      'dtcg/js': [
        'dtcg/color/hex',
        'dtcg/dimension/string',
        'dtcg/shadow/css',
        'dtcg/typography/css',
        'name/camel'
      ]
    }
  },

  // Source token files (DTCG format from dembrandt)
  // Only load the most recent tokens file to avoid collisions
  source: [findLatestTokensFile()],

  // Platform-specific outputs
  platforms: {
    // CSS Variables
    css: {
      transformGroup: 'dtcg/css',
      buildPath: 'build/css/',
      files: [
        {
          destination: 'variables.css',
          format: 'css/variables-extended',
          options: {
            outputReferences: false
          }
        }
      ]
    },

    // SCSS Variables
    scss: {
      transformGroup: 'dtcg/scss',
      buildPath: 'build/scss/',
      files: [
        {
          destination: '_variables.scss',
          format: 'scss/variables',
          options: {
            outputReferences: true
          }
        }
      ]
    },

    // JavaScript/TypeScript
    js: {
      transformGroup: 'dtcg/js',
      buildPath: 'build/js/',
      files: [
        {
          destination: 'tokens.js',
          format: 'javascript/es6',
          options: {
            outputReferences: true
          }
        },
        {
          destination: 'tokens.d.ts',
          format: 'typescript/es6-declarations'
        }
      ]
    },

    // JSON (flattened)
    json: {
      transformGroup: 'dtcg/js',
      buildPath: 'build/json/',
      files: [
        {
          destination: 'tokens.json',
          format: 'json/flat'
        }
      ]
    }
  }
};
