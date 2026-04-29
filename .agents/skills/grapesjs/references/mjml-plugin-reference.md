# GrapesJS MJML Plugin Reference

## Table of Contents
- Overview
- Installation & Setup
- Plugin Options
- Supported MJML Components
- Getting MJML / HTML Output
- Initial Template
- Custom MJML Components
- i18n Support
- Common Patterns
- Gotchas & Tips

## Overview

The `grapesjs-mjml` plugin enables MJML (Mailjet Markup Language) components inside GrapesJS, creating a newsletter/email builder. MJML is rendered in real-time using the official v4 compiler, producing cross-client-compatible responsive email HTML.

**Requires:** GrapesJS v0.15.9 or higher

## Installation & Setup

```bash
npm i grapesjs-mjml
```

### HTML/Script usage
```html
<link href="path/to/grapes.min.css" rel="stylesheet"/>
<script src="path/to/grapes.min.js"></script>
<script src="path/to/grapesjs-mjml.min.js"></script>

<div id="gjs">
  <mjml>
    <mj-body>
      <mj-section>
        <mj-column>
          <mj-text>My Company</mj-text>
        </mj-column>
      </mj-section>
    </mj-body>
  </mjml>
</div>

<script>
  const editor = grapesjs.init({
    fromElement: true,
    container: '#gjs',
    plugins: ['grapesjs-mjml'],
    pluginsOpts: {
      'grapesjs-mjml': { /* options */ }
    }
  });
</script>
```

### ESM / Module usage
```js
import 'grapesjs/dist/css/grapes.min.css';
import grapesjs from 'grapesjs';
import grapesJSMJML from 'grapesjs-mjml';

const editor = grapesjs.init({
  fromElement: true,
  container: '#gjs',
  plugins: [grapesJSMJML],
  pluginsOpts: {
    [grapesJSMJML]: { /* options */ }
  },
});
```

## Plugin Options

| Option | Default | Description |
|---|---|---|
| `blocks` | All MJML blocks | Array of block IDs to include |
| `block` | `(blockId) => ({})` | Function to customize block properties by ID |
| `codeViewerTheme` | `'hopscotch'` | Theme for the code viewer |
| `customComponents` | `[]` | Array of custom MJML component definitions |
| `importPlaceholder` | `''` | Placeholder for the import modal |
| `imagePlaceholderSrc` | placeholder URL | Default image placeholder source |
| `i18n` | `{}` | i18n configuration object |
| `mjmlParser` | `mjml-browser` | Custom MJML parser function `(input, options) => MJMLParseResults` |
| `overwriteExport` | `true` | Overwrite the default `getHtml` to output MJML |
| `preMjml` | `''` | MJML code to prepend before export |
| `postMjml` | `''` | MJML code to append after export |
| `resetBlocks` | `true` | Reset default GrapesJS blocks |
| `resetDevices` | `true` | Reset default devices to email-appropriate sizes |
| `resetStyleManager` | `true` | Reset Style Manager with MJML-specific properties |
| `hideSelector` | `true` | Hide the selector manager (MJML uses inline styles) |
| `useXmlParser` | `false` | Use XML parser for self-closing tags like `<mj-image/>` |
| `columnsPadding` | `'10px 0'` | Default padding for columns |
| `useCustomTheme` | `true` | Apply custom editor theme |

### Example with common options
```js
grapesjs.init({
  container: '#gjs',
  fromElement: true,
  plugins: [grapesJSMJML],
  pluginsOpts: {
    [grapesJSMJML]: {
      resetBlocks: true,
      resetStyleManager: true,
      resetDevices: true,
      // Wrap exported MJML with head content
      preMjml: `
        <mj-head>
          <mj-font name="Roboto" href="https://fonts.googleapis.com/css?family=Roboto" />
          <mj-attributes>
            <mj-all font-family="Roboto, Arial, sans-serif" />
          </mj-attributes>
        </mj-head>
      `,
      postMjml: '',
      // Customize specific blocks
      block: (blockId) => {
        if (blockId === 'mj-1-column') {
          return { category: 'Sections' };
        }
        return {};
      },
    },
  },
});
```

## Supported MJML Components

The plugin registers the following MJML components as GrapesJS component types:

### Structure Components
| MJML Tag | Description |
|---|---|
| `mj-body` | Email body container |
| `mj-section` | Row/section container |
| `mj-column` | Column within a section |
| `mj-group` | Group of columns |
| `mj-wrapper` | Full-width wrapper |

### Content Components
| MJML Tag | Description |
|---|---|
| `mj-text` | Text content |
| `mj-image` | Image element |
| `mj-button` | Call-to-action button |
| `mj-divider` | Horizontal divider |
| `mj-spacer` | Vertical space |
| `mj-hero` | Hero section with bg image |
| `mj-raw` | Raw HTML content |

### Social & Navigation
| MJML Tag | Description |
|---|---|
| `mj-social` | Social icons container |
| `mj-social-element` | Individual social icon |
| `mj-navbar` | Navigation bar |
| `mj-navbar-link` | Navigation link |

### Head Components
| MJML Tag | Description |
|---|---|
| `mj-head` | Head section |
| `mj-style` | CSS styles |
| `mj-font` | Custom fonts |

## Getting MJML / HTML Output

### Get MJML Source
When `overwriteExport` is `true` (default), `editor.getHtml()` returns the **MJML code**, not raw HTML:

```js
const mjmlCode = editor.getHtml();
// Returns: <mjml><mj-body>...</mj-body></mjml>
```

### Get Compiled HTML (email-ready)
To get the final compiled HTML (what gets sent as email):

```js
// Method 1: Use the built-in command
const result = editor.runCommand('mjml-code-to-html');
const emailHtml = result?.html;

// Method 2: Use the mjml-browser parser directly
import mjml2html from 'mjml-browser';
const mjmlCode = editor.getHtml();
const { html } = mjml2html(mjmlCode);
```

### Get Project Data (for storage)
```js
// Save project JSON (for reloading into editor later)
const projectData = editor.getProjectData();

// Load project back
editor.loadProjectData(projectData);
```

### Full Export Example
```js
// Get everything you need for sending/storing
const mjmlSource = editor.getHtml();           // MJML source
const compiledHtml = editor.runCommand('mjml-code-to-html')?.html;  // Email HTML
const projectData = editor.getProjectData();    // Editor state JSON
```

## Initial Template

### From Element
```html
<div id="gjs">
  <mjml>
    <mj-body>
      <mj-section>
        <mj-column>
          <mj-text font-size="20px" color="#333" font-family="Helvetica">
            Hello World
          </mj-text>
          <mj-image width="300px" src="https://example.com/logo.png" />
          <mj-button background-color="#F45E43" href="https://example.com">
            Click Me
          </mj-button>
        </mj-column>
      </mj-section>
    </mj-body>
  </mjml>
</div>
```

### Programmatically
```js
const editor = grapesjs.init({
  container: '#gjs',
  plugins: [grapesJSMJML],
  // Load from project data (preferred for reload)
  projectData: savedProjectData,
});
```

## Custom MJML Components

You can create custom MJML components and register them with the plugin:

```js
import grapesjs from 'grapesjs';
import grapesJSMJML from 'grapesjs-mjml';

// Define a custom component (follows GrapesJS component type pattern)
const customAccordion = (editor, { coreMjmlModel, coreMjmlView }) => {
  editor.DomComponents.addType('mj-accordion', {
    isComponent: el => el.tagName === 'MJ-ACCORDION',

    model: {
      ...coreMjmlModel, // Inherit MJML model behavior
      defaults: {
        name: 'Accordion',
        draggable: '[data-gjs-type=mj-column]',
        droppable: false,
        'style-default': { 'font-size': '14px' },
        stylable: ['font-size', 'color', 'font-family'],
        traits: ['css-class'],
      },
    },

    view: {
      ...coreMjmlView, // Inherit MJML view rendering
      tagName: 'tr',
      attributes: { style: 'display: table; width: 100%;' },
    },
  });

  // Add a block for it
  editor.BlockManager.add('mj-accordion', {
    label: 'Accordion',
    content: '<mj-accordion></mj-accordion>',
    category: 'Custom',
  });
};

grapesjs.init({
  container: '#gjs',
  plugins: [grapesJSMJML],
  pluginsOpts: {
    [grapesJSMJML]: {
      customComponents: [customAccordion],
    },
  },
});
```

### Using a Custom MJML Parser

If you have extended MJML with custom tags:

```js
import customMjmlParser from 'custom-mjml-parser';
import customImage from './components/customImage';

grapesjs.init({
  container: '#gjs',
  plugins: [grapesJSMJML],
  pluginsOpts: {
    [grapesJSMJML]: {
      mjmlParser: customMjmlParser,
      customComponents: [customImage],
    },
  },
});
```

## i18n Support

```js
import nl from 'grapesjs/locale/nl';
import mjmlNL from 'grapesjs-mjml/locale/nl';

grapesjs.init({
  container: '#gjs',
  i18n: {
    // locale: 'en',
    // detectLocale: true,
    // localeFallback: 'en',
    messages: { nl: nl },
  },
  plugins: [grapesJSMJML],
  pluginsOpts: {
    [grapesJSMJML]: {
      i18n: { nl: mjmlNL },
    },
  },
});
```

## Common Patterns

### Custom Editor Layout for Email Builder

```js
const editor = grapesjs.init({
  container: '#gjs',
  fromElement: true,
  plugins: [grapesJSMJML],
  pluginsOpts: {
    [grapesJSMJML]: {
      resetBlocks: true,
      resetStyleManager: true,
    },
  },
  // Storage
  storageManager: {
    type: 'remote',
    options: {
      remote: {
        urlStore: '/api/templates/store',
        urlLoad: '/api/templates/load',
        onStore: (data, editor) => ({
          projectData: data,
          mjml: editor.getHtml(),
          html: editor.runCommand('mjml-code-to-html')?.html,
        }),
        onLoad: result => result.projectData,
      },
    },
  },
});
```

### Adding preMjml Head Styles

Use `preMjml` to inject `<mj-head>` content that applies globally to the template:

```js
{
  preMjml: `
    <mj-head>
      <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700" />
      <mj-attributes>
        <mj-all font-family="Inter, Arial, sans-serif" />
        <mj-text font-size="16px" line-height="1.5" color="#333333" />
        <mj-button background-color="#4F46E5" border-radius="6px" font-size="16px" />
      </mj-attributes>
      <mj-style>
        a { color: #4F46E5; text-decoration: none; }
      </mj-style>
    </mj-head>
  `,
}
```

### Listening to MJML Component Events

```js
// Component selection
editor.on('component:selected', model => {
  const type = model.get('type');
  if (type?.startsWith('mj-')) {
    console.log('MJML component selected:', type);
  }
});

// After template change, recompile
editor.on('update', () => {
  const html = editor.runCommand('mjml-code-to-html')?.html;
  // Update preview, etc.
});
```

## Gotchas & Tips

### 1. `editor.getHtml()` returns MJML, not HTML
When `overwriteExport: true` (default), `editor.getHtml()` returns MJML source. Use `editor.runCommand('mjml-code-to-html')?.html` for compiled email HTML.

### 2. The plugin resets blocks, styles, and devices
By default `resetBlocks`, `resetStyleManager`, and `resetDevices` are all `true`. The plugin replaces defaults with email-appropriate ones. Set to `false` if you want to keep your own.

### 3. MJML uses inline styles
MJML compiles to inline CSS. The selector manager is hidden by default (`hideSelector: true`) since CSS classes aren't the primary styling mechanism in emails.

### 4. Project data vs MJML vs HTML
- **Project data** (`editor.getProjectData()`) — For saving/loading in the editor
- **MJML** (`editor.getHtml()`) — Source markup
- **HTML** (`editor.runCommand('mjml-code-to-html')?.html`) — Final email output

### 5. `<body>` tag in MJML export
Some setups may insert unwanted `<body>` tags in the MJML export. If this happens, override the wrapper's `toHTML()`:

```js
const wrType = editor.DomComponents.getType('wrapper');
const wrModel = wrType.model;
editor.DomComponents.addType('wrapper', {
  model: {
    toHTML(opts) {
      return this.getInnerHTML(opts);
    },
  },
});
```

### 6. Component Type Names
All MJML component types in GrapesJS are named with their MJML tag names: `mj-body`, `mj-section`, `mj-column`, `mj-text`, `mj-image`, `mj-button`, etc. You can reference them with `component.is('mj-text')` or `component.get('type') === 'mj-section'`.

### 7. Style Manager Properties
When `resetStyleManager` is `true`, the plugin sets up email-specific CSS properties (like `background-color`, `color`, `font-family`, `font-size`, `padding`, `border-radius`, etc.) appropriate for each MJML component type.
