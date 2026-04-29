# GrapesJS UI Layout Patterns

## Table of Contents
- Full Editor Layout
- Panels & Sidebar
- Layer/Style/Trait Switcher
- Responsive Device Switcher
- Theming (→ style-customization.md)
- Custom Module UIs

## Full Editor Layout

A typical GrapesJS editor setup with panels, sidebar, blocks, layers, styles, and traits:

```html
<div class="panel__top">
  <div class="panel__basic-actions"></div>
  <div class="panel__devices"></div>
  <div class="panel__switcher"></div>
</div>
<div class="editor-row">
  <div class="editor-canvas">
    <div id="gjs">...</div>
  </div>
  <div class="panel__right">
    <div class="layers-container"></div>
    <div class="styles-container"></div>
    <div class="traits-container"></div>
  </div>
</div>
<div id="blocks"></div>
```

```css
body, html { margin: 0; height: 100%; }
.panel__top { padding: 0; width: 100%; display: flex; justify-content: space-between; }
.panel__basic-actions { position: initial; }
.panel__devices { position: initial; }
.panel__switcher { position: initial; }
.editor-row { display: flex; justify-content: flex-start; align-items: stretch; flex-wrap: nowrap; height: 300px; }
.editor-canvas { flex-grow: 1; }
.panel__right { flex-basis: 230px; position: relative; overflow-y: auto; }
```

## Panels & Sidebar

### Resizable Sidebar Panel

```js
grapesjs.init({
  panels: {
    defaults: [
      {
        id: 'layers',
        el: '.panel__right',
        resizable: {
          maxDim: 350,
          minDim: 200,
          tc: false, cl: true, cr: false, bc: false,
          keyWidth: 'flex-basis', // flex child needs flex-basis instead of width
        },
      },
    ],
  },
  layerManager: { appendTo: '.layers-container' },
  selectorManager: { appendTo: '.styles-container' },
  styleManager: { appendTo: '.styles-container', sectors: [/* ... */] },
  traitManager: { appendTo: '.traits-container' },
});
```

## Layer/Style/Trait Switcher

Toggle visibility of sidebar panels using commands:

```js
grapesjs.init({
  panels: {
    defaults: [
      {
        id: 'panel-switcher',
        el: '.panel__switcher',
        buttons: [
          { id: 'show-layers', active: true, label: 'Layers', command: 'show-layers', togglable: false },
          { id: 'show-style', active: true, label: 'Styles', command: 'show-styles', togglable: false },
          { id: 'show-traits', active: true, label: 'Traits', command: 'show-traits', togglable: false },
        ],
      },
    ],
  },
});

// Commands to toggle panels
editor.Commands.add('show-layers', {
  getRowEl(editor) { return editor.getContainer().closest('.editor-row'); },
  getEl(row) { return row.querySelector('.layers-container'); },
  run(editor) { this.getEl(this.getRowEl(editor)).style.display = ''; },
  stop(editor) { this.getEl(this.getRowEl(editor)).style.display = 'none'; },
});

editor.Commands.add('show-styles', {
  getRowEl(editor) { return editor.getContainer().closest('.editor-row'); },
  getEl(row) { return row.querySelector('.styles-container'); },
  run(editor) { this.getEl(this.getRowEl(editor)).style.display = ''; },
  stop(editor) { this.getEl(this.getRowEl(editor)).style.display = 'none'; },
});

editor.Commands.add('show-traits', {
  getEl(editor) {
    return editor.getContainer().closest('.editor-row').querySelector('.traits-container');
  },
  run(editor) { this.getEl(editor).style.display = ''; },
  stop(editor) { this.getEl(editor).style.display = 'none'; },
});
```

## Responsive Device Switcher

```js
grapesjs.init({
  deviceManager: {
    devices: [
      { name: 'Desktop', width: '' },
      { name: 'Mobile', width: '320px', widthMedia: '480px' },
    ],
  },
  panels: {
    defaults: [
      {
        id: 'panel-devices',
        el: '.panel__devices',
        buttons: [
          { id: 'device-desktop', label: 'D', command: 'set-device-desktop', active: true, togglable: false },
          { id: 'device-mobile', label: 'M', command: 'set-device-mobile', togglable: false },
        ],
      },
    ],
  },
});

editor.Commands.add('set-device-desktop', { run: editor => editor.setDevice('Desktop') });
editor.Commands.add('set-device-mobile', { run: editor => editor.setDevice('Mobile') });
```

## Action Buttons (undo, redo, export, JSON)

```js
editor.Panels.addPanel({
  id: 'basic-actions',
  el: '.panel__basic-actions',
  buttons: [
    {
      id: 'visibility',
      active: true,
      className: 'btn-toggle-borders',
      label: '<u>B</u>',
      command: 'sw-visibility', // built-in: toggle component borders
    },
    {
      id: 'export',
      className: 'btn-open-export',
      label: 'Exp',
      command: 'export-template',
      context: 'export-template',
    },
    {
      id: 'show-json',
      className: 'btn-show-json',
      label: 'JSON',
      context: 'show-json',
      command(editor) {
        editor.Modal.setTitle('Components JSON')
          .setContent(`<textarea style="width:100%; height: 250px;">
            ${JSON.stringify(editor.getComponents())}
          </textarea>`)
          .open();
      },
    },
  ],
});
```

## Theming

See [style-customization.md](style-customization.md) for full theming reference (CSS classes and CSS custom properties).

## Custom Module UIs

All major modules support a `custom: true` option for full UI replacement:

| Module | Config | Event |
|---|---|---|
| Block Manager | `blockManager: { custom: true }` | `block:custom` |
| Style Manager | `styleManager: { custom: true }` | `style:custom` |
| Trait Manager | `traitManager: { custom: true }` | `trait:custom` |
| Layer Manager | `layerManager: { custom: true }` | `layer:custom` |
| Asset Manager | `assetManager: { custom: true }` | `asset:custom` |

Each event provides a `container` HTMLElement and the relevant data to render your own UI.

```js
grapesjs.init({
  blockManager: { custom: true },
  styleManager: { custom: true },
  traitManager: { custom: true },
  layerManager: { custom: true },
  assetManager: { custom: true },
});

editor.on('block:custom', ({ blocks, dragStart, dragStop, container }) => { /* ... */ });
editor.on('style:custom', ({ container }) => {
  const sm = editor.StyleManager;
  const sectors = sm.getSectors({ visible: true });
  // Render your custom style manager using sectors data
});
editor.on('trait:custom', ({ container }) => { /* ... */ });
editor.on('layer:custom', ({ container, root }) => { /* ... */ });
editor.on('asset:custom', ({ open, assets, types, close, remove, select, container }) => { /* ... */ });
```
