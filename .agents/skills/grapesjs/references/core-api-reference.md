# GrapesJS Core API Reference

## Table of Contents
- Component Model Properties (draggable, droppable, resizable, locked, etc.)
- Component Hierarchy & Traversal
- UndoManager
- Canvas API (zoom, coords, drag, frame access)
- CssComposer (programmatic CSS rules)
- Keymaps (keyboard shortcuts)
- Editor Advanced Methods

## Component Model Properties

Every component supports these properties in `defaults`. They control behavior in the editor canvas.

### Drag & Drop Constraints

```js
editor.DomComponents.addType('my-type', {
  model: {
    defaults: {
      // Can this component be dragged? Accepts:
      // - true/false
      // - CSS selector string: 'form, form *' (can only be dragged into matching parents)
      // - Function: (target, destination) => Boolean
      draggable: true,

      // Can other components be dropped inside? Same format as draggable.
      // - true/false
      // - CSS selector string: '[data-gjs-type=column]' (only accept matching children)
      // - Function: (target, destination) => Boolean
      droppable: true,
    },
  },
});
```

### Resizable

```js
defaults: {
  // Enable resize handles on the component. Can be:
  // - false (default): no resizing
  // - true: enable with default options
  // - Object: Resizer options (see below)
  resizable: {
    // Which handles to show (true = show, false = hide)
    tl: false, // top-left
    tc: false, // top-center
    tr: false, // top-right
    cl: false, // center-left
    cr: true,  // center-right (width resize)
    bl: false, // bottom-left
    bc: true,  // bottom-center (height resize)
    br: false, // bottom-right

    // CSS property to update on resize
    keyWidth: 'width',     // or 'flex-basis', 'max-width', etc.
    keyHeight: 'height',

    // Constraints
    minDim: 10,   // minimum dimension in px
    maxDim: 1000, // maximum dimension
    step: 1,      // resize step
    currentUnit: 1, // set 1 to use current unit instead of px

    // Use raw dimensions (avoids unit conversion)
    ratioDefault: false, // maintain aspect ratio
  },
}
```

### Selection & Visibility

```js
defaults: {
  selectable: true,   // Can be clicked to select in canvas
  hoverable: true,    // Shows highlight outline on hover
  badgable: true,     // Shows name badge when selected/hovered
  highlightable: true,// Shows dotted border highlight
  layerable: true,    // Visible in the Layers panel

  // Lock: disables selection of this component AND children in canvas.
  // Children can opt out by setting their own locked: false
  locked: undefined,  // undefined = not locked, true = locked
}
```

### Edit & Modify

```js
defaults: {
  removable: true,  // Can be deleted
  copyable: true,   // Can be copied/pasted
  editable: false,  // Content is editable (used for Text components)
  void: false,      // Self-closing tag (no closing tag in HTML export, e.g. <br/>, <hr/>)
}
```

### Style Constraints

```js
defaults: {
  // Control which CSS properties appear in Style Manager
  stylable: true,              // true = all properties, or array of allowed properties
  // stylable: ['width', 'height', 'padding'],

  unstylable: [],              // Array of CSS properties to hide from Style Manager
  // unstylable: ['color', 'font-size'],

  'stylable-require': [],      // Properties marked as toRequire to show
}
```

### Propagate, Delegate, Toolbar

```js
defaults: {
  // Propagate: properties inherited by ALL NEW children appended to this component
  propagate: ['removable', 'draggable'],
  // Example: { removable: false, draggable: false, propagate: ['removable', 'draggable'] }
  // New children will also get removable: false, draggable: false, AND the propagate array

  // Delegate: redirect commands to another component
  delegate: {
    remove: (cmp) => cmp.closestType('other-type'),  // delegate delete
    move: (cmp) => cmp.closestType('other-type'),     // delegate move
    copy: (cmp) => cmp.closestType('other-type'),     // delegate copy
    select: (cmp) => cmp.closestType('other-type'),   // delegate selection
  },

  // Toolbar: array of toolbar items shown when component is selected
  // Default (when falsy): auto-adds core:component-exit, tlb-move, tlb-clone, tlb-delete
  toolbar: [
    { attributes: { class: 'fa fa-arrows' }, command: 'tlb-move' },
    { attributes: { class: 'fa fa-clone' }, command: 'tlb-clone' },
    { attributes: { class: 'fa fa-trash' }, command: 'tlb-delete' },
  ],
}
```

## Component Hierarchy & Traversal

```js
const cmp = editor.getSelected();

// Parent
cmp.parent();               // immediate parent Component (or null)
cmp.parents();              // array of all ancestor Components

// Children
cmp.components();           // children collection
cmp.getChildAt(0);          // child at index
cmp.getLastChild();         // last child
cmp.empty();                // remove all children

// Search (CSS query — works only after render)
cmp.find('div.my-class');   // all descendants matching CSS query
cmp.closest('.some-class'); // closest ancestor matching CSS query

// Search (by type — works before render too)
cmp.findType('image');         // all descendants of type
cmp.findFirstType('image');    // first descendant of type (or undefined)
cmp.closestType('section');    // closest ancestor of type

// Checks
cmp.contains(otherCmp);       // is otherCmp a descendant?
cmp.is('image');               // check component type
cmp.isInstanceOf('text');      // check if instance of type (includes inheritance)
cmp.isChildOf(parentCmp);     // check if child of component
cmp.isChildOf('text');         // check if child of component type
cmp.index();                   // position among siblings

// Iterate
cmp.onAll(component => { /* runs on self + all descendants */ });
cmp.forEachChild(child => { /* runs on all children (not self) */ });

// Move
cmp.move(destComponent, { at: 0 }); // move into another component at index
cmp.replaceWith('<div>New</div>');   // replace with new content

// Drag mode (per-component)
cmp.setDragMode('absolute');  // 'absolute' | 'translate' | ''
cmp.getDragMode();
```

## canMove — Check Drag/Drop Validity

```js
const result = editor.Components.canMove(targetComponent, sourceComponent);
// result: { result: Boolean, source: Component, target: Component, reason: Number }
//
// reason codes:
//   0 — Invalid source (default, ignore if result is true)
//   1 — Source doesn't accept target as destination (source.draggable rejects it)
//   2 — Target doesn't accept source (target.droppable rejects it)

// Can also check with component definition or HTML string
editor.Components.canMove(wrapper, { tagName: 'a', draggable: false });
editor.Components.canMove(wrapper, '<form>...</form>');
```

## UndoManager

```js
const um = editor.UndoManager;

// Undo / Redo
um.undo();                    // Undo last change
um.redo();                    // Redo last change
um.undoAll();                 // Undo all changes
um.redoAll();                 // Redo all changes

// State checks
um.hasUndo();                 // Boolean: can undo?
um.hasRedo();                 // Boolean: can redo?

// Stack management
um.getStack();                // Collection of all change records
um.clear();                   // Clear the entire stack

// Track/untrack entities (components and CSS rules are auto-tracked)
um.add(modelOrCollection);    // Add entity to tracking
um.remove(modelOrCollection); // Remove entity from tracking
um.removeAll();               // Remove all tracked entities
um.isRegistered(entity);      // Check if entity is tracked

// Pause/resume tracking
um.stop();                    // Stop tracking changes
um.start();                   // Resume tracking changes

// Execute code without tracking (useful for programmatic batch changes)
um.skip(() => {
  // Changes inside this callback are NOT recorded in undo stack
  component.setStyle({ color: 'red' });
  component.addAttributes({ 'data-x': '1' });
});
```

### UndoManager Events
```js
editor.on('undo', () => { /* undo executed */ });
editor.on('redo', () => { /* redo executed */ });
```

## Canvas API

```js
const canvas = editor.Canvas;

// Zoom
canvas.setZoom(50);             // Set zoom to 50% (0-100)
canvas.getZoom();               // Get current zoom value

// Pan / Coordinates
canvas.setCoords(100, 200);     // Set canvas position (x, y)
canvas.getCoords();             // { x: 100, y: 200 }

// Scroll to element
canvas.scrollTo(component, { behavior: 'smooth' });
canvas.scrollTo(component, { force: true }); // even if already visible

// Focus
canvas.hasFocus();              // Boolean: is canvas focused?

// Frame access (canvas runs inside an iframe)
canvas.getWindow();             // iframe Window object
canvas.getDocument();           // iframe document
canvas.getBody();               // iframe body element
canvas.getFrameEl();            // iframe HTMLIFrameElement
canvas.getElement();            // canvas container HTMLElement
canvas.getRect();               // canvas bounding rect data

// Custom badge labels
canvas.setCustomBadgeLabel(component => {
  return component.getName();   // customize the badge text shown on hover/select
});

// Refresh canvas tools positioning (after CSS layout changes)
canvas.refresh();
canvas.refresh({ spots: true }); // also update spot positions

// Custom drag-and-drop
canvas.startDrag({ content: { type: 'my-component' } });
canvas.startDrag({ content: '<div>...</div>' });
canvas.endDrag();
canvas.getLastDragResult();     // last Component created from drag-and-drop

// World/screen coordinate transforms
canvas.getWorldRectToScreen(boxRect);
```

### Canvas Spots API
```js
// Add/update spots
const spot = canvas.addSpot({ type: 'my-custom-spot', component });
canvas.addSpot({ id: spot.id, component: otherComponent }); // update by ID

// Get spots
canvas.getSpots();                         // all spots
canvas.getSpots({ type: 'select' });       // filter by type

// Remove spots
canvas.removeSpots({ type: 'my-spot' });   // remove by type
canvas.removeSpots(arrayOfSpots);          // remove specific spots
canvas.removeSpots();                      // remove all

// Check custom spot overrides
canvas.hasCustomSpot('target');            // true if customSpots config overrides it
```

### Canvas Events

```js
// Drag & drop
editor.on('canvas:drop', (dataTransfer, model) => { /* something dropped */ });
editor.on('canvas:dragenter', (dataTransfer, content) => {});
editor.on('canvas:dragover', (event) => {});
editor.on('canvas:dragend', (event) => {});
editor.on('canvas:dragdata', (dataTransfer, result) => {
  // Customize what is dropped by modifying result.content
});

// Zoom & pan
editor.on('canvas:zoom', () => { console.log(canvas.getZoom()); });
editor.on('canvas:coords', () => { console.log(canvas.getCoords()); });

// Canvas pan/move
editor.on('canvas:move:start', () => {});
editor.on('canvas:move', () => {});
editor.on('canvas:move:end', () => {});

// Frame lifecycle
editor.on('canvas:frame:load', ({ window }) => { /* iframe loaded */ });
editor.on('canvas:frame:load:head', ({ window }) => { /* head scripts loaded */ });
editor.on('canvas:frame:load:body', ({ window }) => { /* body rendered with components */ });
editor.on('canvas:frame:unload', ({ frame }) => { /* frame unloading */ });

// Spots
editor.on('canvas:spot', () => { /* any spot update */ });
editor.on('canvas:spot:add', ({ spot }) => {});
editor.on('canvas:spot:update', ({ spot }) => {});
editor.on('canvas:spot:remove', ({ spot }) => {});

// Canvas refresh
editor.on('canvas:refresh', (options) => {});
```

## CssComposer — Programmatic CSS Rules

```js
const css = editor.Css;

// Add rules from CSS string
const rules = css.addRules('.my-cls { color: red } @media (max-width: 992px) { .my-cls { color: darkred } }');
rules.map(rule => rule.toCSS());

// Set/update a single rule
css.setRule('.class1.class2', { color: 'red' });
// output: .class1.class2 { color: red }

// With pseudo-selector and mixed selectors
css.setRule('.class1:hover, div#myid', { color: 'red' });

// With media query (at-rule)
css.setRule('.class1:hover', { color: 'red' }, {
  atRuleType: 'media',
  atRuleParams: '(min-width: 500px)',
});
// output: @media (min-width: 500px) { .class1:hover { color: red } }

// Merge styles instead of replacing (addStyles option)
css.setRule('.class1', { color: 'red', background: 'red' });
css.setRule('.class1', { color: 'blue' }, { addStyles: true });
// output: .class1 { color: blue; background: red }

// Get rules
css.getRule('.myclass:hover');
css.getRule('.myclass', { atRuleType: 'media', atRuleParams: '(min-width: 500px)' });
css.getRules('.myclass');  // all rules for selector
css.getRules();            // ALL rules in project

// Get component-specific rules
const id = someComponent.getId();
const rules = css.getRules(`#${id}`);

// Remove rules
css.remove('.my-cls');              // by selector (matches at-rules too)
css.remove(css.getRules('.my-cls')); // by CssRule array

// Clear all rules
css.clear();
```

## Keymaps — Keyboard Shortcuts

```js
const keymaps = editor.Keymaps;

// Add a keymap with a callback
keymaps.add('ns:my-keymap', '⌘+j, ctrl+j', editor => {
  console.log('do stuff');
});

// Add a keymap that triggers a command
keymaps.add('ns:save', '⌘+s, ctrl+s', 'core:store', {
  prevent: true,  // Prevent default browser action (e.g. browser save dialog)
});

// Force handler execution even if keymap is disabled
keymaps.add('ns:forced', '⌘+k, ctrl+k', handler, { force: true });

// Get / remove
keymaps.get('ns:my-keymap');       // { keys, handler }
keymaps.getAll();                  // { id1: {...}, id2: {...} }
keymaps.remove('ns:my-keymap');    // returns removed keymap
keymaps.removeAll();               // remove all keymaps

// Configure defaults at init
grapesjs.init({
  keymaps: {
    defaults: {
      'ns:my-shortcut': {
        keys: '⌘+z, ctrl+z',
        handler: 'some-command-id',
      },
    },
  },
});
```

### Keymap Events
```js
editor.on('keymap:add', (keymap) => { /* new keymap added */ });
editor.on('keymap:remove', (keymap) => { /* keymap removed */ });
editor.on('keymap:emit', (keymapId, shortcutUsed, event) => { /* keymap triggered */ });
```

## Editor Advanced Methods

```js
// Selection
editor.selectToggle(component);     // Toggle component selection
editor.getEditing();                // Get component in RTE editing mode (or null)
editor.getSelectedToStyle();        // Get stylable entity (Component or CssRule)

// Output options
editor.getHtml({ cleanId: true });  // Remove auto-generated IDs from output
editor.getCss({
  json: true,             // Return array of CssRule objects instead of string
  avoidProtected: true,   // Exclude protected CSS
  onlyMatched: true,      // Only rules matching specified component
  keepUnusedStyles: true,  // Force keep all defined rules
  component: someComponent, // CSS for specific component only
});

// HTML with re-importable component props
component.toHTML({ withProps: true }); // includes data-gjs-* attributes

// Add components with style control
editor.addComponents('<div class="cls">New</div>', {
  avoidUpdateStyle: true, // Don't update existing CSS rules from inline styles
});

// Load with clear option
await editor.load({}, { clear: true }); // Clear editor state (dirty counter, undo manager)

// Custom CSS parser
editor.setCustomParserCss(css => {
  const result = [];
  // parse CSS string into CssRule objects
  result.push({ selectors: '.someclass', style: { color: 'red' } });
  return result;
});
editor.setCustomParserCss(null); // remove custom parser

// Logging
editor.log('Something done!', { ns: 'my-plugin', level: 'info' });
// Triggers: log, log:info, log-my-plugin, log-my-plugin:info

// Translation
editor.t('styleManager.properties.width'); // translated label

// Safe HTML template literals
const safeHtml = editor.html`Escaped ${unsafeStr} unescaped $${safeStr}`;

// Drag mode (global)
editor.setDragMode('absolute'); // 'absolute' | 'translate'
```

### Component Drag & Resize Events
```js
// Drag events (includes target, parent, index in callback object)
editor.on('component:drag:start', ({ target, parent, index }) => {});
editor.on('component:drag', ({ target, parent, index }) => {});
editor.on('component:drag:end', ({ target, parent, index }) => {});

// Resize event
editor.on('component:resize', () => {});

// Component lifecycle with abort
editor.on('component:remove:before', (model, removeFn, opts) => {
  // Set opts.abort = true to prevent removal
  // Call removeFn() later to complete the removal if aborted
});

// Clone
editor.on('component:clone', (newModel) => {});

// Style update
editor.on('component:styleUpdate', (model) => {});
editor.on('component:styleUpdate:color', (model) => {}); // specific property

// Type events
editor.on('component:type:add', (newType) => {});
editor.on('component:type:update', (updatedType) => {});
```

### Additional Editor Events
```js
editor.on('update', () => { /* any project change */ });
editor.on('load', () => { /* editor fully loaded and rendered */ });
editor.on('project:load', ({ project, initial }) => {});
editor.on('project:loaded', ({ project, initial }) => {}); // only on success
editor.on('project:get', ({ project }) => {
  project.myCustomKey = 'value'; // extend project data on export
});
editor.on('destroy', () => {});
editor.on('destroyed', () => {});
editor.on('log', (msg, opts) => {});
```
