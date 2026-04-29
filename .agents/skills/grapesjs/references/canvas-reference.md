# GrapesJS Canvas Reference

## Table of Contents
- Configuration
- Canvas Spots
- Built-in Spot Types
- Disabling Built-in Spots
- Custom Canvas Spots
- Canvas API

## Configuration

```js
grapesjs.init({
  canvas: {
    // Full list: https://github.com/GrapesJS/grapesjs/blob/master/src/canvas/config/config.ts
  },
});
```

## Canvas Spots

Canvas spots are elements drawn on top of the canvas. They represent component interactions like selection, hover, resize, etc. Each spot has a `type`, a `component`, and coordinates.

### Built-in Spot Types

| Type | Description |
|---|---|
| `select` | Shows selected components, renders toolbar items |
| `resize` | Allows component resizing (based on `component.resizable`) |
| `target` | Highlights during drag & drop |
| `hover` | Highlights hovered component, shows name |
| `spacing` | Shows component offsets (margins, paddings) |

#### Getting Component Toolbar Items
```js
const toolbarItems = editor.getSelected().toolbar;
```

#### Getting Resizable Options
```js
const resizable = editor.getSelected().resizable;
```

#### Customizing Drag Indicators
```css
.gjs-placeholder.horizontal { border-color: transparent red; }
.gjs-placeholder.vertical { border-color: red transparent; }
.gjs-placeholder-int { background-color: red; }
```

## Disabling Built-in Spots

```js
grapesjs.init({
  canvas: {
    // Disable only the hover type spot
    customSpots: { hover: true },

    // Or disable ALL built-in spots
    customSpots: true,
  },
});
```

## Custom Canvas Spots

You can create your own canvas spot types and render custom overlays:

```js
const { Canvas } = editor;

// Add a custom spot for a component
Canvas.addSpot({ type: 'my-text-spot', component });

// Remove all spots of a type
Canvas.removeSpots({ type: 'my-text-spot' });

// Get all current spots
const spots = Canvas.getSpots();

// Listen to spot updates
editor.on('canvas:spot', () => {
  const spots = Canvas.getSpots();
  // Update your UI
});

// Mount custom UI to the spots container
editor.onReady(() => {
  Canvas.getSpotsEl().appendChild(myCustomElement);
});

// Each spot provides style coordinates
spots.forEach(spot => {
  const style = spot.getStyle(); // { top, left, width, height }
});
```

### Example: Custom "Add" Button on Text Components

```js
editor.on('component:toggled', component => {
  const { Canvas } = editor;
  Canvas.removeSpots({ type: 'my-text-spot' });

  if (component === editor.getSelected() && component.is('text')) {
    Canvas.addSpot({ type: 'my-text-spot', component });
  }
});
```

### Important Notes
- The spots container uses `pointer-events: none` by default
- Re-enable `pointer-events: auto` on interactive elements within spots
- Pass `component` to spots so coordinates update on scroll/resize
