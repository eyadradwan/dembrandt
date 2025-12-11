# Using Style Dictionary with Dembrandt

Style Dictionary is integrated to transform extracted design tokens into platform-specific formats.

## Quick Start

### 1. Extract tokens in DTCG format

```bash
# Extract from any website
node index.js stripe.com --dtcg

# Output saved to: output/stripe.com/TIMESTAMP.tokens.json
```

### 2. Transform tokens to platform formats

```bash
# Build all platforms (CSS, SCSS, JS, JSON)
npm run build:tokens

# Clean generated files
npm run clean:tokens
```

## Generated Files

Style Dictionary generates platform-specific files in the `build/` directory:

```
build/
├── css/
│   └── variables.css          # CSS custom properties
├── scss/
│   └── _variables.scss         # SCSS variables
├── js/
│   ├── tokens.js               # ES6 module
│   └── tokens.d.ts             # TypeScript definitions
└── json/
    └── tokens.json             # Flattened JSON
```

## Usage Examples

### CSS

```css
@import './build/css/variables.css';

.button {
  background-color: var(--color-palette-635bff);
  padding: var(--spacing-spacing-4);
}
```

### SCSS

```scss
@import './build/scss/variables';

.button {
  background-color: $color-palette-635bff;
  padding: $spacing-spacing-4;
}
```

### JavaScript/TypeScript

```javascript
import { colorPalette635bff, spacingSpacing4 } from './build/js/tokens.js';

const button = document.querySelector('.button');
button.style.backgroundColor = colorPalette635bff;
button.style.padding = spacingSpacing4;
```

## Configuration

The Style Dictionary configuration is in `style-dictionary.config.js`. It includes:

### Custom Transforms

- **`dtcg/color/hex`**: Extracts hex values from DTCG color objects
- **`dtcg/dimension/string`**: Converts dimension objects to strings (e.g., `"16px"`)

### Transform Groups

- **`dtcg/css`**: For CSS custom properties
- **`dtcg/scss`**: For SCSS variables
- **`dtcg/js`**: For JavaScript/TypeScript

## Workflow

```bash
# 1. Extract tokens
node index.js stripe.com --dtcg

# 2. Transform tokens
npm run build:tokens

# 3. Use generated files in your project
# Import build/css/variables.css, build/scss/_variables.scss, or build/js/tokens.js
```

## Advanced Configuration

Edit `style-dictionary.config.js` to:

- Add new platforms (Android, iOS, etc.)
- Customize transforms
- Change output paths
- Add filters

See [Style Dictionary documentation](https://styledictionary.com) for more options.

## Supported Token Types

Style Dictionary transforms these DTCG token types:

- ✅ Colors (hex extraction)
- ✅ Dimensions (px, rem, etc.)
- ✅ Font families
- ✅ Font weights
- ✅ Numbers
- ✅ Shadows
- ✅ Typography composites

## Multiple Sources

To transform tokens from multiple sites:

```bash
# Extract from multiple sites
node index.js stripe.com --dtcg
node index.js material.io --dtcg
node index.js shopify.com --dtcg

# Transform all tokens
npm run build:tokens
```

Style Dictionary will merge all `*.tokens.json` files from the `output/` directory.
