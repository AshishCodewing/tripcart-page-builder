# GrapesJS Components & JS + Symbols

## Table of Contents
- Component Scripts (basic)
- Passing Properties to Scripts (script-props)
- Script Dependencies
- Canvas Script Injection
- Symbols (reusable components)
- Symbol API
- Symbol Overrides
- Symbol Events

## Component Scripts

Attach JavaScript to components that runs inside the canvas iframe (isolated from the editor).

```js
// Avoid arrow functions — `this` is bound to the component's DOM element
const script = function () {
  alert('Hi');
  console.log('the element', this); // `this` = the component's HTMLElement
};

editor.Components.addType('comp-with-js', {
  model: {
    defaults: {
      script,
      style: { width: '100px', height: '100px', background: 'red' },
    },
  },
});
```

### How Scripts Work in Export

The editor attaches a unique ID to each component with a script. In exported HTML:

```html
<div id="c764"></div>
<script>
  var items = document.querySelectorAll('#c764');
  for (var i = 0, len = items.length; i < len; i++) {
    (function(){
      alert('Hi');
      console.log('the element', this);
    }.bind(items[i]))();
  }
</script>
```

Multiple instances of the same type share one `<script>` block with all their IDs in the selector.

### CRITICAL: Script Scope Isolation

Scripts execute inside the canvas iframe. You CANNOT reference variables from the outer editor scope:

```js
// BAD — myVar is NOT available inside the script
const myVar = 'John';
const script = function () {
  alert('Hi ' + myVar); // ERROR: myVar is undefined
};

// GOOD — use script-props to pass data (see below)
```

## Passing Properties to Scripts (script-props)

Use `script-props` to pass component properties into the script function. Changes to these properties also re-execute the script.

```js
const script = function (props) {
  const myLibOpts = {
    prop1: props.myprop1,
    prop2: props.myprop2,
  };
  alert('My lib options: ' + JSON.stringify(myLibOpts));
};

editor.Components.addType('comp-with-js', {
  model: {
    defaults: {
      script,
      // Default values for custom properties
      myprop1: 'value1',
      myprop2: '10',
      // Traits to change properties from the UI
      traits: [
        {
          type: 'select',
          name: 'myprop1',
          changeProp: true, // bind to component property, not attribute
          options: [
            { value: 'value1', name: 'Value 1' },
            { value: 'value2', name: 'Value 2' },
          ],
        },
        {
          type: 'number',
          name: 'myprop2',
          changeProp: true,
        },
      ],
      // Declare which properties to pass to script
      // Changing any of these re-triggers the script
      'script-props': ['myprop1', 'myprop2'],
    },
  },
});
```

### script vs script-export

```js
defaults: {
  // Runs in both canvas and exported HTML
  script: function() { /* ... */ },

  // Runs ONLY in exported HTML (overrides `script` in exports)
  // Useful for different behavior in editor vs production
  'script-export': function() { /* ... */ },
}
```

## Script Dependencies

### Component-related Dependencies (recommended)

Load dependencies dynamically inside the script. They appear in final HTML only when the component exists.

```js
const script = function (props) {
  const initLib = function () {
    const el = this;
    someExtLib(el, { prop1: props.myprop1 });
  };

  if (typeof someExtLib == 'undefined') {
    const script = document.createElement('script');
    script.onload = initLib;
    script.src = 'https://.../somelib.min.js';
    document.body.appendChild(script);
  } else {
    initLib();
  }
};
```

### Template-related Dependencies

Inject scripts/styles globally into the canvas iframe (NOT included in exported HTML):

```js
grapesjs.init({
  canvas: {
    scripts: ['https://.../somelib.min.js'],
    styles: ['https://.../ext-style.min.css'],
  },
});
```

You must separately include these in the page where the final HTML is rendered.

## Symbols — Reusable Components

Symbols let you reuse components across your project. Changes to one propagate to all instances.

- **Main Symbol**: the template component (stored separately in project JSON)
- **Instance Symbol**: copies linked to the main (changes sync automatically)

### Create a Symbol

```js
const anyComponent = editor.getSelected();
const symbolMain = editor.Components.addSymbol(anyComponent);
// anyComponent is now an Instance, symbolMain is the Main Symbol

// Create another instance from main or any existing instance
const secondInstance = editor.Components.addSymbol(symbolMain);

// Append instance to canvas
editor.getWrapper().append(secondInstance, { at: 0 });
```

### Get Symbol Info

```js
const info = editor.Components.getSymbolInfo(symbolMain);
// {
//   isSymbol: true,     // it's a symbol (main or instance)
//   isRoot: true,       // it's the root of the symbol tree
//   isMain: true,       // it's the Main Symbol
//   isInstance: false,   // it's not an Instance
//   main: Component,    // reference to Main Symbol
//   instances: [Component, Component], // all instances
//   relatives: [Component, Component], // related symbols
// }

// Check any component
const info2 = editor.Components.getSymbolInfo(editor.getSelected());
if (info2.isSymbol) {
  console.log('This is a symbol', info2.isMain ? '(main)' : '(instance)');
}
```

### Get All Symbols

```js
const symbols = editor.Components.getSymbols();
// [Component, Component, ...] — array of all Main Symbols
```

### Symbol Overrides

Prevent specific property changes from propagating to other instances:

```js
// Skip propagation of specific properties
anyInstance.setSymbolOverride(['children', 'classes']);
anyInstance.getSymbolOverride(); // ['children', 'classes']

// Skip ALL propagation
anyInstance.setSymbolOverride(true);

// Changes to overridden properties stay local
anyInstance.set('my-property', false);
otherInstance.get('my-property'); // unchanged — override blocked propagation
```

### Detach Symbol

Convert an instance back to a regular component:

```js
editor.Components.detachSymbol(instanceComponent);
// instanceComponent is no longer a symbol
const info = editor.Components.getSymbolInfo(instanceComponent);
info.isSymbol; // false
```

### Remove Main Symbol

Removing a Main Symbol detaches all its instances:

```js
const symbolMain = editor.Components.getSymbols()[0];
symbolMain.remove(); // all instances become regular components
```

## Symbol Events

```js
// Main symbol events
editor.on('symbol:main:add', ({ component }) => { /* new main symbol created */ });
editor.on('symbol:main:update', ({ component }) => { /* main symbol updated */ });
editor.on('symbol:main:remove', ({ component }) => { /* main symbol removed */ });
editor.on('symbol:main', ({ event, component }) => { /* catch-all for main */ });

// Instance symbol events
editor.on('symbol:instance:add', ({ component }) => { /* new instance created */ });
editor.on('symbol:instance:remove', ({ component }) => { /* instance removed */ });
editor.on('symbol:instance', ({ event, component }) => { /* catch-all for instances */ });

// Catch-all for any symbol change
editor.on('symbol', () => { /* any symbol update */ });
```
