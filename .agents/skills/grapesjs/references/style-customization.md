# GrapesJS Style Customization

## Table of Contents
- Editor Theming (visual appearance)
- Style Manager (CSS properties UI)
- Sector & Property Definitions
- Property Types
- Built-in Properties
- Custom Property Types
- Custom Style Manager UI
- Component CSS
- Selector Manager
- I18n for Styles
- Programmatic Usage

## Editor Theming

### CSS Classes
Override GrapesJS appearance by placing custom CSS after the default stylesheet:

```css
/* Primary background */
.gjs-one-bg { background-color: #78366a; }
/* Secondary text color */
.gjs-two-color { color: rgba(255, 255, 255, 0.7); }
/* Tertiary background */
.gjs-three-bg { background-color: #ec5896; color: white; }
/* Quaternary text color */
.gjs-four-color, .gjs-four-color-h:hover { color: #ec5896; }
```

### CSS Custom Properties (recommended)
Same result using CSS variables:

```css
:root {
  --gjs-primary-color: #78366a;
  --gjs-secondary-color: rgba(255, 255, 255, 0.7);
  --gjs-tertiary-color: #ec5896;
  --gjs-quaternary-color: #ec5896;
}
```

## Style Manager Configuration

```js
grapesjs.init({
  styleManager: {
    sectors: [/* sector definitions */],
    // appendTo: '.styles-container', // render target
    // custom: true, // enable custom UI mode
  },
  selectorManager: {
    appendTo: '.styles-container', // render selector UI
    // componentFirst: true, // style individual component, not class
  },
});
```

## Sector Definitions

```js
sectors: [
  {
    id: 'dimension',        // optional, generated from name
    name: 'Dimension',
    open: false,            // collapsed by default
    properties: [
      // String shorthand (uses built-in definition)
      'width',
      'min-width',
      // Extend built-in with custom options
      { extend: 'max-width', units: ['px', '%'] },
      // Full property definition
      {
        type: 'number',
        label: 'Padding',
        property: 'padding',
        default: '0',
        units: ['px', '%'],
        min: 0,
      },
    ],
  },
  {
    name: 'Typography',
    properties: [
      'font-family',
      'font-size',
      'font-weight',
      'letter-spacing',
      'color',
      'line-height',
      'text-align',
      'text-decoration',
      'text-shadow',
    ],
  },
]
```

## Property Types

### `base` (default)
Simple text input. Fallback when type is omitted.
```js
{ property: 'some-css-property', label: 'Base', default: 'value' }
```

### `number`
Numeric input with units.
```js
{
  type: 'number',
  property: 'font-size',
  units: ['px', '%', 'em', 'rem', 'vh', 'vw'],
  min: 0, max: 100, default: '16px',
}
```

### `slider`
Same props as `number`, rendered as slider UI.

### `color`
Color picker.
```js
{ type: 'color', property: 'color', default: '#000' }
```

### `select`
Dropdown options.
```js
{
  type: 'select',
  property: 'display',
  default: 'block',
  options: [
    { id: 'block', label: 'Block' },
    { id: 'flex', label: 'Flex' },
    { id: 'none', label: 'None' },
  ],
}
```

### `radio`
Same props as `select`, radio button UI.

### `composite`
CSS shorthand (e.g., margin, padding).
```js
{
  type: 'composite',
  property: 'margin',
  properties: [
    { type: 'number', units: ['px'], default: '0', property: 'margin-top' },
    { type: 'number', units: ['px'], default: '0', property: 'margin-right' },
    { type: 'number', units: ['px'], default: '0', property: 'margin-bottom' },
    { type: 'number', units: ['px'], default: '0', property: 'margin-left' },
  ],
}
```

### `stack`
Multiple values (e.g., text-shadow, box-shadow, transform).
```js
{
  type: 'stack',
  property: 'box-shadow',
  properties: [
    { type: 'number', units: ['px'], default: '0', property: 'x' },
    { type: 'number', units: ['px'], default: '0', property: 'y' },
    { type: 'number', units: ['px'], default: '0', property: 'blur' },
    { type: 'number', units: ['px'], default: '0', property: 'spread' },
    { type: 'color', default: 'black', property: 'color' },
  ],
}
```

## Built-in Properties

Check and use built-in property definitions:

```js
editor.StyleManager.getBuiltIn('width');      // get single definition
editor.StyleManager.getBuiltInAll();           // get all definitions
editor.StyleManager.addBuiltIn('new-prop', {   // add/extend
  type: 'number', label: 'New prop',
});
```

Use built-in props as strings in sector definitions:
```js
properties: ['width', 'min-width', { extend: 'max-width', units: ['px'] }]
```

## Custom Property Types

```js
editor.StyleManager.addType('my-range', {
  create({ props, change }) {
    const el = document.createElement('div');
    el.innerHTML = `<input type="range" class="my-input" min="${props.min}" max="${props.max}"/>`;
    const inputEl = el.querySelector('.my-input');
    inputEl.addEventListener('change', event => change({ event }));
    inputEl.addEventListener('input', event => change({ event, partial: true }));
    return el;
  },
  emit({ props, updateStyle }, { event, partial }) {
    const { value } = event.target;
    updateStyle(`${value}px`, { partial });
  },
  update({ value, el }) {
    el.querySelector('.my-input').value = parseInt(value, 10);
  },
  destroy() { /* cleanup */ },
});

// Usage in sector
{
  type: 'my-range',
  property: 'font-size',
  default: '15',
  min: 10,
  max: 70,
}
```

## Custom Style Manager UI

For fully custom UI (e.g., React, Vue components):

```js
grapesjs.init({
  styleManager: { custom: true },
});

editor.on('style:custom', ({ container }) => {
  const sm = editor.StyleManager;
  const sectors = sm.getSectors({ visible: true });
  // Render your custom UI into `container` using sectors data
  // Each sector: sector.getName(), sector.getProperties()
  // Each property: prop.getType(), prop.getValue(), prop.upValue(val)
});
```

## Component CSS

### Inline styles via component
```js
component.setStyle({ color: 'red', 'font-size': '16px' });
```

### Component-scoped styles (in type definition)
```js
editor.DomComponents.addType('my-card', {
  model: {
    defaults: {
      attributes: { class: 'card' },
      styles: `
        .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
        @media (max-width: 768px) {
          .card { padding: 8px; }
        }
      `,
    },
  },
});
```
Styles are grouped per component type and auto-removed when all instances are removed.

### Add CSS rules programmatically
```js
editor.addStyle('.my-class { color: red; font-size: 14px; }');
editor.setStyle('.my-class { color: blue; }'); // replaces all styles
```

## Selector Manager

```js
grapesjs.init({
  selectorManager: {
    appendTo: '.styles-container',
    componentFirst: true, // style component directly, not shared class
  },
});

const sm = editor.SelectorManager;
// Manage selectors/classes on selected component
```

## Component Style Constraints

Restrict which CSS properties are available per component type:

```js
editor.DomComponents.addType('restricted-cmp', {
  model: {
    defaults: {
      // Only show these properties in Style Manager
      stylable: ['width', 'height', 'padding'],
      // Or hide specific properties
      unstylable: ['color', 'font-size'],
    },
  },
});
```

## I18n for Style Manager

```js
grapesjs.init({
  styleManager: {
    sectors: [
      {
        id: 'dimension-sector',
        name: 'Dimension',
        properties: ['width', { id: 'display-prop', property: 'display', type: 'select', options: [
          { id: 'block', label: 'Block' },
          { id: 'none', label: 'None' },
        ]}],
      },
    ],
  },
  i18n: {
    messagesAdd: {
      en: {
        styleManager: {
          sectors: { 'dimension-sector': 'Dimension EN' },
          properties: { width: 'Width EN', 'display-prop': 'Display EN' },
          options: { 'display-prop': { block: 'Block EN', none: 'None EN' } },
        },
      },
      es: {
        styleManager: {
          sectors: { 'dimension-sector': 'Dimensión' },
          properties: { width: 'Ancho', 'display-prop': 'Mostrar' },
        },
      },
    },
  },
});
```

## Programmatic Style Manager Usage

```js
const sm = editor.StyleManager;

// Add/remove sectors
sm.addSector('new-sector', { name: 'New', properties: ['width'] });
sm.removeSector('new-sector');

// Add/remove properties
sm.addProperty('sector-id', { type: 'number', property: 'min-width' });
sm.removeProperty('sector-id', 'min-width');
sm.getProperty('sector-id', 'min-width');

// Select targets
const btn = editor.getWrapper().find('button')[0];
btn && sm.select(btn);
sm.select('.btn > span'); // CSS selector as target

// Get/update styles
sm.getSelected()?.getStyle();
sm.addStyleTargets({ color: 'red' });
```
