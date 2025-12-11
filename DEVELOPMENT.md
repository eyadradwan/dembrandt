# Development Guide

This guide covers development workflows, testing, and contribution guidelines for Dembrandt.

## Setup

1. Clone the repository:
```bash
git clone https://github.com/dembrandt/dembrandt.git
cd dembrandt
```

2. Install dependencies:
```bash
npm install
```

3. Install Playwright browser:
```bash
npm run install-browser
```

## Development Commands

```bash
# Run locally
node index.js <url>

# Run with options
node index.js stripe.com --debug        # Visible browser
node index.js stripe.com --json-only    # JSON only
node index.js stripe.com --slow         # 3x timeouts

# Brand challenge suite (tests against complex sites)
npm run brand-challenge

# Version diff test (compare npm vs main branch)
# Use Claude Code slash command: /test-version-diff stripe.com
```

## Testing

### Version Diff Test

Compare output between the latest npm release and the main branch to catch regressions before publishing.

**Using Claude Code (recommended):**

```bash
# In Claude Code, use the slash command:
/test-version-diff stripe.com

# Or just:
/test-version-diff
# (Claude will ask for the domain)
```

**What it does:**
1. Runs the latest npm release version (`npx dembrandt@latest`) against your domain
2. Runs the current main branch version against the same domain
3. Compares the JSON outputs and shows differences
4. Saves all outputs and diff to `test-output/<domain>-<timestamp>/`

**Output files:**
- `npm-release.json` - Output from latest npm version
- `main-branch.json` - Output from current main branch
- `npm-release-formatted.json` - Sorted JSON for npm version
- `main-branch-formatted.json` - Sorted JSON for main branch
- `diff.txt` - Line-by-line differences (if any)

**Example outputs:**

✅ **No differences:**
```
🧪 Testing version diff for: stripe.com
📁 Output directory: ./test-output/stripe.com-20250128-143022

📦 Running latest npm release version...
✅ NPM version output saved to: ./test-output/stripe.com-20250128-143022/npm-release.json

🔨 Running current main branch version...
✅ Main branch output saved to: ./test-output/stripe.com-20250128-143022/main-branch.json

📊 Comparing outputs...

✅ No differences found! Outputs are identical.

📁 All files saved to: ./test-output/stripe.com-20250128-143022
```

📝 **With differences:**
```
📊 Comparing outputs...

📝 Differences found:

--- ./test-output/stripe.com-20250128-143022/npm-release-formatted.json
+++ ./test-output/stripe.com-20250128-143022/main-branch-formatted.json
@@ -45,7 +45,10 @@
       "value": "1px",
       "count": 33,
       "confidence": "high"
-    }
+    },
+    "combinations": [
+      { "width": "1px", "style": "solid", "color": "#e0e0e0" }
+    ]
   ],
   "typography": {

💾 Full diff saved to: ./test-output/stripe.com-20250128-143022/diff.txt
```

**Use cases:**
- Before releases to ensure changes don't break existing functionality
- After major refactoring to verify output consistency
- When debugging extraction issues to compare behavior
- To document intentional changes in output format

### Brand Challenge Suite

Test against complex SPA/interactive sites with heavy JavaScript:

```bash
npm run brand-challenge
```

Tests against:
- Tesla (WebGL/3D, bot protection)
- Dribbble (interactive previews)
- SoundCloud (SPA, media streaming)
- Airtable (SaaS grids, dynamic content)
- Product Hunt (SPA, async listings)
- Behance (portfolios, AJAX content)

Uses `--slow` flag for 3x timeouts (24s hydration, 12s stabilization).

## Project Structure

```
dembrandt/
├── index.js                      # CLI entry point
├── lib/
│   ├── extractors.js            # Core extraction functions
│   └── display.js               # Terminal output formatting
├── test-version-diff.mjs        # Version comparison test
├── test-version-diff.sh         # Version comparison test (bash)
├── run-no-login-challenge.mjs   # Brand challenge suite
├── examples/                    # Example outputs
└── output/                      # Extraction outputs
```

## Architecture

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation, including:
- Entry point flow and browser lifecycle
- Core extraction engine and parallelization
- Anti-bot protection strategies
- Color confidence scoring
- Display layer formatting

## Release Process

1. **Test changes:**
```bash
npm run test:version-diff stripe.com
npm run brand-challenge
```

2. **Update version:**
```bash
# Edit package.json version manually
git add package.json
git commit -m "bump: version x.y.z"
```

3. **Create git tag:**
```bash
git tag -a vx.y.z -m "Release vx.y.z - Description"
git push origin main --tags
```

4. **Publish to npm:**
```bash
npm publish
```

5. **Verify:**
```bash
npx dembrandt@latest stripe.com
```

## Contributing Guidelines

1. **Code style:**
   - Use ES modules (`import`/`export`)
   - Prefer async/await over promises
   - Add JSDoc comments for public functions
   - Follow existing formatting conventions

2. **Adding extractors:**
   - Add function to `lib/extractors.js`
   - Add to `Promise.all` in `extractBranding()`
   - Add display function to `lib/display.js`
   - Add call in `displayResults()`

3. **Testing:**
   - Test against multiple sites (simple and complex)
   - Run brand challenge suite
   - Run version diff test against known-good sites
   - Test with `--debug` flag to see browser behavior

4. **Pull requests:**
   - Include test results in PR description
   - Document breaking changes clearly
   - Update CHANGELOG.md if applicable
   - Add examples for new features

## Common Development Tasks

### Adding a new extraction function

1. Create async function in `lib/extractors.js`:
```javascript
async function extractNewFeature(page) {
  return await page.evaluate(() => {
    // DOM analysis in browser context
    return { /* extracted data */ };
  });
}
```

2. Add to extraction pipeline in `extractBranding()`:
```javascript
const results = await Promise.all([
  extractLogo(page),
  extractColors(page),
  extractNewFeature(page), // <-- Add here
  // ... other extractors
]);
```

3. Add display function in `lib/display.js`:
```javascript
function displayNewFeature(data) {
  if (!data) return;
  console.log(chalk.dim('├─') + ' ' + chalk.bold('New Feature'));
  // ... formatting
}
```

4. Call display function in `displayResults()`:
```javascript
displayNewFeature(data.newFeature);
```

### Modifying confidence scoring

Edit `contextScores` object in `extractColors()` or similar scoring logic:

```javascript
const contextScores = {
  logo: 5,        // Highest confidence
  brand: 5,
  primary: 4,
  button: 3,
  // ... add your contexts
};
```

### Adjusting timeouts

Timeouts use `timeoutMultiplier` (3x when `--slow` is used):

```javascript
const timeoutMultiplier = options.slow ? 3 : 1;

// Navigation timeout
await page.goto(url, {
  timeout: 20000 * timeoutMultiplier,
  waitUntil: 'networkidle',
});

// Hydration wait
await page.waitForTimeout(8000 * timeoutMultiplier);
```

## Debugging Tips

1. **Use `--debug` flag** to see browser:
```bash
node index.js stripe.com --debug
```

2. **Check extraction step by step:**
```javascript
// Add console.log in extractors.js
console.log('Extracted colors:', colors);
```

3. **Test in browser console:**
```javascript
// Copy extraction logic to browser DevTools
document.querySelectorAll('button').length
```

4. **Check bot detection:**
```bash
# If site loads differently, likely bot detection
node index.js site.com --debug
# vs
# Open site.com in regular Chrome
```

5. **Verify output structure:**
```bash
node index.js stripe.com --json-only
cat output/stripe.com/latest.json | jq .
```

## Performance Optimization

- Extractors run in parallel using `Promise.all()`
- DOM queries happen in browser context (`page.evaluate()`)
- Minimize data transfer between Node and browser
- Use CSS selectors efficiently
- Cache repeated computations

## Security Considerations

- Never expose API keys or credentials
- Validate all user input (URLs)
- Use stealth mode to avoid bot detection
- Respect robots.txt and site ToS
- Rate limit to avoid overwhelming servers

## Support

- Issues: https://github.com/dembrandt/dembrandt/issues
- Discussions: https://github.com/dembrandt/dembrandt/discussions
- Email: info@esajuhana.com
