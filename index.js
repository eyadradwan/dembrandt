#!/usr/bin/env node

/**
 * Dembrandt - Design Token Extraction CLI
 *
 * Extracts design tokens, brand colors, typography, spacing, and component styles
 * from any website using Playwright with advanced bot detection avoidance.
 */

import { program } from "commander";
import chalk from "chalk";
import ora from "ora";
import { chromium } from "playwright-core";
import { extractBranding } from "./lib/extractors.js";
import { displayResults } from "./lib/display.js";
import { toW3CFormat } from "./lib/w3c-exporter.js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

program
  .name("dembrandt")
  .description("Extract design tokens from any website")
  .version("0.4.0")
  .argument("<url>")
  .option("--json-only", "Output raw JSON")
  .option("--save-output", "Save JSON file to output folder")
  .option("--dtcg", "Export in W3C Design Tokens (DTCG) format")
  .option("--transform", "Transform DTCG tokens to CSS/SCSS/JS with Style Dictionary (requires --dtcg)")
  .option("--dark-mode", "Extract colors from dark mode")
  .option("--mobile", "Extract from mobile viewport")
  .option("--slow", "3x longer timeouts for slow-loading sites")
  .option("--no-sandbox", "Disable browser sandbox (needed for Docker/CI)")
  .action(async (input, opts) => {
    let url = input;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    const spinner = ora("Starting extraction...").start();
    let browser = null;

    try {
      let useHeaded = false;
      let result;

      while (true) {
        spinner.text = `Launching browser (${useHeaded ? "visible" : "headless"
          } mode)`;
        const launchArgs = ["--disable-blink-features=AutomationControlled"];
        if (opts.noSandbox) {
          launchArgs.push("--no-sandbox", "--disable-setuid-sandbox");
        }
        browser = await chromium.launch({
          headless: !useHeaded,
          args: launchArgs,
        });

        try {
          result = await extractBranding(url, spinner, browser, {
            navigationTimeout: 90000,
            darkMode: opts.darkMode,
            mobile: opts.mobile,
            slow: opts.slow,
          });
          break;
        } catch (err) {
          await browser.close();
          browser = null;

          if (useHeaded) throw err;

          if (
            err.message.includes("Timeout") ||
            err.message.includes("net::ERR_")
          ) {
            spinner.warn(
              "Bot detection detected → retrying with visible browser"
            );
            console.error(chalk.dim(`  ↳ Error: ${err.message}`));
            console.error(chalk.dim(`  ↳ URL: ${url}`));
            console.error(chalk.dim(`  ↳ Mode: headless`));
            useHeaded = true;
            continue;
          }
          throw err;
        }
      }

      console.log();

      // Convert to W3C format if requested
      const outputData = opts.dtcg ? toW3CFormat(result) : result;

      // Save JSON output if --save-output or --dtcg is specified
      if ((opts.saveOutput || opts.dtcg) && !opts.jsonOnly) {
        try {
          const domain = new URL(url).hostname.replace("www.", "");
          const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-")
            .split(".")[0];
          // Save to current working directory, not installation directory
          const outputDir = join(process.cwd(), "output", domain);
          mkdirSync(outputDir, { recursive: true });

          const suffix = opts.dtcg ? '.tokens' : '';
          const filename = `${timestamp}${suffix}.json`;
          const filepath = join(outputDir, filename);
          writeFileSync(filepath, JSON.stringify(outputData, null, 2));

          console.log(
            chalk.dim(
              `💾 JSON saved to: ${chalk.hex('#8BE9FD')(
                `output/${domain}/${filename}`
              )}`
            )
          );

          // Run Style Dictionary transformation if --transform is enabled
          if (opts.transform && opts.dtcg) {
            console.log();
            console.log(chalk.hex('#8BE9FD')('🔄 Transforming tokens with Style Dictionary...'));
            try {
              // Update style-dictionary config to use this specific file
              const configContent = `export default {
  parsers: [{ name: 'dtcg', pattern: /\\.tokens\\.json$/ }],
  hooks: {
    transforms: {
      'dtcg/color/hex': {
        type: 'value',
        filter: (token) => token.$type === 'color',
        transform: (token) => {
          if (token.$value && typeof token.$value === 'object' && token.$value.hex) {
            return token.$value.hex;
          }
          return token.$value;
        }
      },
      'dtcg/dimension/string': {
        type: 'value',
        filter: (token) => token.$type === 'dimension',
        transform: (token) => {
          if (token.$value && typeof token.$value === 'object') {
            return \`\${token.$value.value}\${token.$value.unit}\`;
          }
          return token.$value;
        }
      }
    },
    transformGroups: {
      'dtcg/css': ['dtcg/color/hex', 'dtcg/dimension/string', 'name/kebab'],
      'dtcg/scss': ['dtcg/color/hex', 'dtcg/dimension/string', 'name/kebab'],
      'dtcg/js': ['dtcg/color/hex', 'dtcg/dimension/string', 'name/camel']
    }
  },
  source: ['${filepath}'],
  platforms: {
    css: {
      transformGroup: 'dtcg/css',
      buildPath: 'output/${domain}/',
      files: [{ destination: 'variables.css', format: 'css/variables', options: { outputReferences: true } }]
    },
    scss: {
      transformGroup: 'dtcg/scss',
      buildPath: 'output/${domain}/',
      files: [{ destination: '_variables.scss', format: 'scss/variables', options: { outputReferences: true } }]
    },
    js: {
      transformGroup: 'dtcg/js',
      buildPath: 'output/${domain}/',
      files: [
        { destination: 'tokens.js', format: 'javascript/es6', options: { outputReferences: true } },
        { destination: 'tokens.d.ts', format: 'typescript/es6-declarations' }
      ]
    }
  }
};`;
              const tempConfigPath = join(outputDir, '.style-dictionary.config.js');
              writeFileSync(tempConfigPath, configContent);

              // Run style-dictionary
              execSync(`npx style-dictionary build --config "${tempConfigPath}"`, {
                stdio: 'inherit',
                cwd: process.cwd()
              });

              console.log();
              console.log(chalk.hex('#50FA7B')('✓ Tokens transformed successfully!'));
              console.log(chalk.dim(`  CSS: ${chalk.hex('#8BE9FD')(`output/${domain}/variables.css`)}`));
              console.log(chalk.dim(`  SCSS: ${chalk.hex('#8BE9FD')(`output/${domain}/_variables.scss`)}`));
              console.log(chalk.dim(`  JS: ${chalk.hex('#8BE9FD')(`output/${domain}/tokens.js`)}`));
              console.log(chalk.dim(`  TS: ${chalk.hex('#8BE9FD')(`output/${domain}/tokens.d.ts`)}`));
            } catch (err) {
              console.log(chalk.hex('#FFB86C')(`⚠ Style Dictionary transformation failed: ${err.message}`));
              console.log(chalk.dim('  Make sure style-dictionary is installed: npm install -g style-dictionary'));
            }
          } else if (opts.transform && !opts.dtcg) {
            console.log();
            console.log(chalk.hex('#FFB86C')('⚠ --transform requires --dtcg flag'));
          }
        } catch (err) {
          console.log(
            chalk.hex('#FFB86C')(`⚠ Could not save JSON file: ${err.message}`)
          );
        }
      }

      // Output to terminal
      if (opts.jsonOnly) {
        console.log(JSON.stringify(outputData, null, 2));
      } else {
        console.log();
        displayResults(result);
      }
    } catch (err) {
      spinner.fail("Failed");
      console.error(chalk.red("\n✗ Extraction failed"));
      console.error(chalk.red(`  Error: ${err.message}`));
      console.error(chalk.dim(`  URL: ${url}`));
      process.exit(1);
    } finally {
      if (browser) await browser.close();
    }
  });

program.parse();
