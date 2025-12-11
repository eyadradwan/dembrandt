#!/usr/bin/env node
/**
 * Build design tokens from extracted DTCG files
 * Usage: node build-tokens.js [domain]
 */

import { readdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, 'output');

// Get all domains with .tokens.json files
function getAvailableDomains() {
  if (!existsSync(outputDir)) {
    return [];
  }

  const domains = readdirSync(outputDir)
    .filter(name => {
      const domainPath = join(outputDir, name);
      if (!statSync(domainPath).isDirectory()) return false;

      // Check if directory has .tokens.json files
      const files = readdirSync(domainPath);
      return files.some(f => f.endsWith('.tokens.json'));
    });

  return domains;
}

// Get latest .tokens.json file for a domain
function getLatestTokenFile(domain) {
  const domainPath = join(outputDir, domain);
  const files = readdirSync(domainPath)
    .filter(f => f.endsWith('.tokens.json'))
    .map(f => ({
      name: f,
      path: join(domainPath, f),
      time: statSync(join(domainPath, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  return files.length > 0 ? files[0].path : null;
}

// Build tokens for a specific domain
function buildDomain(domain) {
  const tokenFile = getLatestTokenFile(domain);
  if (!tokenFile) {
    console.error(`No .tokens.json files found for ${domain}`);
    return false;
  }

  console.log(`\n🔨 Building tokens for ${domain}`);
  console.log(`   Source: ${tokenFile.replace(__dirname + '/', '')}`);

  try {
    // Create temporary config for this domain
    const configContent = `
export default {
  parsers: [{ name: 'dtcg', pattern: /\\.tokens\\.json$/ }],
  hooks: {
    transforms: {
      'dtcg/color/hex': {
        type: 'value',
        filter: (token) => token.$type === 'color',
        transform: (token) => token.$value?.hex || token.$value
      },
      'dtcg/dimension/string': {
        type: 'value',
        filter: (token) => token.$type === 'dimension',
        transform: (token) =>
          token.$value && typeof token.$value === 'object'
            ? \`\${token.$value.value}\${token.$value.unit}\`
            : token.$value
      }
    },
    transformGroups: {
      'dtcg/css': ['dtcg/color/hex', 'dtcg/dimension/string', 'name/kebab'],
      'dtcg/scss': ['dtcg/color/hex', 'dtcg/dimension/string', 'name/kebab'],
      'dtcg/js': ['dtcg/color/hex', 'dtcg/dimension/string', 'name/camel']
    }
  },
  source: ['${tokenFile.replace(/\\/g, '/')}'],
  platforms: {
    css: {
      transformGroup: 'dtcg/css',
      buildPath: 'build/${domain}/css/',
      files: [{
        destination: 'variables.css',
        format: 'css/variables',
        options: {
          outputReferences: true,
          fileHeader: () => [
            'Do not edit directly, auto-generated from ${domain}',
            'Source: ${tokenFile.replace(__dirname + '/', '')}'
          ]
        }
      }]
    },
    scss: {
      transformGroup: 'dtcg/scss',
      buildPath: 'build/${domain}/scss/',
      files: [{
        destination: '_variables.scss',
        format: 'scss/variables',
        options: {
          outputReferences: true,
          fileHeader: () => [
            'Do not edit directly, auto-generated from ${domain}',
            'Source: ${tokenFile.replace(__dirname + '/', '')}'
          ]
        }
      }]
    },
    js: {
      transformGroup: 'dtcg/js',
      buildPath: 'build/${domain}/js/',
      files: [
        {
          destination: 'tokens.js',
          format: 'javascript/es6',
          options: {
            outputReferences: true,
            fileHeader: () => [
              'Do not edit directly, auto-generated from ${domain}',
              'Source: ${tokenFile.replace(__dirname + '/', '')}'
            ]
          }
        },
        {
          destination: 'tokens.d.ts',
          format: 'typescript/es6-declarations',
          options: {
            fileHeader: () => [
              'Do not edit directly, auto-generated from ${domain}',
              'Source: ${tokenFile.replace(__dirname + '/', '')}'
            ]
          }
        }
      ]
    },
    json: {
      transformGroup: 'dtcg/js',
      buildPath: 'build/${domain}/json/',
      files: [{
        destination: 'tokens.json',
        format: 'json/flat',
        options: {
          fileHeader: () => ({
            _source: '${domain}',
            _file: '${tokenFile.replace(__dirname + '/', '')}'
          })
        }
      }]
    }
  }
};`;

    const tempConfig = join(__dirname, `.sd-config-${domain}.js`);
    require('fs').writeFileSync(tempConfig, configContent);

    // Run style-dictionary
    execSync(`npx style-dictionary build --config ${tempConfig}`, {
      cwd: __dirname,
      stdio: 'inherit'
    });

    // Clean up temp config
    require('fs').unlinkSync(tempConfig);

    console.log(`   ✓ Built to: build/${domain}/`);
    return true;
  } catch (error) {
    console.error(`   ✗ Build failed: ${error.message}`);
    return false;
  }
}

// Main
const args = process.argv.slice(2);
const requestedDomain = args[0];

const domains = getAvailableDomains();

if (domains.length === 0) {
  console.log('No .tokens.json files found in output/');
  console.log('\nExtract tokens first:');
  console.log('  node index.js stripe.com --dtcg');
  process.exit(1);
}

if (requestedDomain) {
  // Build specific domain
  if (!domains.includes(requestedDomain)) {
    console.error(`Domain "${requestedDomain}" not found`);
    console.log('\nAvailable domains:');
    domains.forEach(d => console.log(`  - ${d}`));
    process.exit(1);
  }
  buildDomain(requestedDomain);
} else {
  // Show available domains and build all
  console.log(`Found ${domains.length} domain${domains.length === 1 ? '' : 's'} with tokens:\n`);
  domains.forEach(d => {
    const file = getLatestTokenFile(d);
    const filename = file.split('/').pop();
    console.log(`  📦 ${d}`);
    console.log(`     ${filename}\n`);
  });

  console.log('Building tokens for all domains...');
  let successCount = 0;
  domains.forEach(domain => {
    if (buildDomain(domain)) {
      successCount++;
    }
  });

  console.log(`\n✓ Built ${successCount}/${domains.length} domain${domains.length === 1 ? '' : 's'}`);
  console.log('\nUsage:');
  console.log('  node build-tokens.js              # Build all domains');
  console.log('  node build-tokens.js stripe.com   # Build specific domain');
}
