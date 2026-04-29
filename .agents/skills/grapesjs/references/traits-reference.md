# GrapesJS Traits Reference

## Table of Contents
- Built-in Trait Types
- Adding Traits to Components
- Dynamic Traits
- Trait Categories
- Binding to Properties
- Updating Traits at Runtime
- Define Custom Trait Type
- Custom Trait Manager UI
- I18n for Traits

## Built-in Trait Types

### Text (default)
```js
{
  type: 'text', // default when type is omitted
  name: 'my-trait', // required, used as attribute name
  label: 'My trait', // label: false removes label column
  placeholder: 'Insert text',
}
```

### Number
```js
{
  type: 'number',
  name: 'count',
  placeholder: '0-100',
  min: 0, max: 100, step: 5,
}
```

### Checkbox
```js
{
  type: 'checkbox',
  name: 'required',
  valueTrue: 'YES',  // default: true
  valueFalse: 'NO',  // default: false
}
```

### Select
```js
{
  type: 'select',
  name: 'type',
  options: [
    { id: 'opt1', label: 'Option 1' },
    { id: 'opt2', label: 'Option 2' },
  ],
}
```

### Color
```js
{ type: 'color', name: 'bg-color' }
```

### Button
```js
{
  type: 'button',
  name: 'action',
  text: 'Click me',
  full: true, // full width
  command: editor => alert('Hello'),
  // or command: 'some-command-id',
}
```

## Adding Traits to Components

```js
editor.Components.addType('input', {
  isComponent: el => el.tagName === 'INPUT',
  model: {
    defaults: {
      traits: [
        'name', // string shorthand = { type: 'text', name: 'name' }
        'placeholder',
        {
          type: 'select',
          name: 'type',
          label: 'Type',
          options: [
            { id: 'text', label: 'Text' },
            { id: 'email', label: 'Email' },
            { id: 'password', label: 'Password' },
            { id: 'number', label: 'Number' },
          ],
        },
        { type: 'checkbox', name: 'required' },
      ],
      // Initial values defined via attributes (since traits bind to attributes by default)
      attributes: { type: 'text', required: true },
    },
  },
});
```

## Dynamic Traits

Traits can be functions that receive the component:

```js
editor.Components.addType('input', {
  model: {
    defaults: {
      traits(component) {
        const result = [];
        if (component.get('draggable')) {
          result.push('name');
        } else {
          result.push({ type: 'select', /* ... */ });
        }
        return result;
      },
    },
  },
});
```

## Trait Categories

```js
const category1 = { id: 'first', label: 'First category' };
const category2 = { id: 'second', label: 'Second category', open: false };

editor.Components.addType('input', {
  model: {
    defaults: {
      traits: [
        { name: 'trait-1', category: category1 },
        { name: 'trait-2', category: category1 },
        { name: 'trait-3', category: category2 },
        { name: 'trait-4', category: category2 },
        // Traits without categories are rendered at the bottom
        { name: 'trait-5' },
      ],
    },
  },
});
```

## Binding to Properties (instead of attributes)

```js
editor.Components.addType('input', {
  model: {
    defaults: {
      traits: [
        {
          name: 'placeholder',
          changeProp: 1, // bind to component property, not attribute
        },
      ],
      // Initial value from property (not attribute)
      placeholder: 'Initial placeholder',
    },
    init() {
      // Listener changes from `change:attributes:*` to `change:*`
      this.on('change:placeholder', this.handlePlhChange);
    },
  },
});
```

## React to Trait Changes

```js
editor.Components.addType('input', {
  model: {
    defaults: { /* ... */ },
    init() {
      this.on('change:attributes:type', this.handleTypeChange);
    },
    handleTypeChange() {
      console.log('Input type changed to: ', this.getAttributes().type);
    },
  },
});
```

## Updating Traits at Runtime

```js
const component = editor.getSelected();

// Get all traits
const traits = component.get('traits');
traits.forEach(trait => console.log(trait.props()));

// Get single trait (by name)
component.getTrait('type').props();

// Update trait properties
component.getTrait('type').set('options', [
  { id: 'opt1', label: 'New option 1' },
  { id: 'opt2', label: 'New option 2' },
]);
component.getTrait('type').set({
  label: 'My type',
  options: [/* ... */],
});

// Add/remove traits
component.addTrait({ name: 'new-trait', type: 'text' }, { at: 0 });
component.removeTrait('old-trait');
```

## Define Custom Trait Type

Custom traits need 3 key methods:
1. `createInput` - Define custom HTML element
2. `onEvent` - Update component on input changes
3. `onUpdate` - Update inputs on component changes

```js
editor.Traits.addType('href-next', {
  noLabel: false, // set true to hide label for all instances
  // templateInput: '', // set to '' to remove wrapper, or custom HTML

  createInput({ trait }) {
    const el = document.createElement('div');
    el.innerHTML = `
      <select class="href-next__type">
        <option value="url">URL</option>
        <option value="email">Email</option>
      </select>
      <div class="href-next__url-inputs">
        <input class="href-next__url" placeholder="Insert URL"/>
      </div>
      <div class="href-next__email-inputs">
        <input class="href-next__email" placeholder="Insert email"/>
        <input class="href-next__email-subject" placeholder="Insert subject"/>
      </div>
    `;
    // Add interactivity
    const inputType = el.querySelector('.href-next__type');
    inputType.addEventListener('change', ev => {
      const inputsUrl = el.querySelector('.href-next__url-inputs');
      const inputsEmail = el.querySelector('.href-next__email-inputs');
      inputsUrl.style.display = ev.target.value === 'url' ? '' : 'none';
      inputsEmail.style.display = ev.target.value === 'email' ? '' : 'none';
    });
    return el;
  },

  // Default captures 'change' event. Override with:
  // eventCapture: ['input'], // capture 'input' event instead

  onEvent({ elInput, component, event }) {
    const inputType = elInput.querySelector('.href-next__type');
    let href = '';
    switch (inputType.value) {
      case 'url':
        href = elInput.querySelector('.href-next__url').value;
        break;
      case 'email':
        const email = elInput.querySelector('.href-next__email').value;
        const subj = elInput.querySelector('.href-next__email-subject').value;
        href = `mailto:${email}${subj ? `?subject=${subj}` : ''}`;
        break;
    }
    component.addAttributes({ href });
  },

  onUpdate({ elInput, component }) {
    const href = component.getAttributes().href || '';
    const inputType = elInput.querySelector('.href-next__type');
    if (href.indexOf('mailto:') === 0) {
      // parse email href and update inputs...
      inputType.value = 'email';
    } else {
      elInput.querySelector('.href-next__url').value = href;
      inputType.value = 'url';
    }
    inputType.dispatchEvent(new CustomEvent('change'));
  },
});
```

### Using with external UI components (React, Vue, etc.)

```js
editor.Traits.addType('slider', {
  createInput({ trait }) {
    const vueInst = new Vue({ render: h => h(VueSlider) }).$mount();
    const sliderInst = vueInst.$children[0];
    sliderInst.$on('change', ev => this.onChange(ev)); // triggers onEvent
    this.sliderInst = sliderInst;
    return vueInst.$el;
  },
  onEvent({ component }) {
    component.addAttributes({ value: this.sliderInst.getValue() || 0 });
  },
  onUpdate({ component }) {
    this.sliderInst.setValue(component.getAttributes().value || 0);
  },
});
```

Key integration points:
1. **Component rendering** (framework-specific mount)
2. **Change propagation** (`this.onChange(ev)` triggers `onEvent`)
3. **Property getters/setters** (read/write from the external component)

## Custom Trait Manager UI

```js
grapesjs.init({
  traitManager: { custom: true },
});

editor.on('trait:custom', ({ container }) => {
  // container: HTMLElement - default element to append custom UI
  // Render your full custom trait UI here
});
```

## I18n for Traits

```js
grapesjs.init({
  i18n: {
    messagesAdd: {
      en: {
        traitManager: {
          empty: 'Select an element before using Trait Manager',
          label: 'Component settings',
          categories: { categoryId: 'Category label' },
          traits: {
            labels: { href: 'Href label' },
            attributes: { href: { placeholder: 'eg. https://google.com' } },
            options: { target: { _blank: 'New window' } },
          },
        },
      },
    },
  },
});
```
