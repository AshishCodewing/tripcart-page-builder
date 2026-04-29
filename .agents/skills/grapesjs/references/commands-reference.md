# GrapesJS Commands Deep Dive

## Table of Contents
- Basic Commands
- Stateful Commands (run/stop)
- Default Commands
- Extending Commands
- Event Hooks
- Interrupting Commands

## Basic Commands

```js
// Simple function command
editor.Commands.add('my-command', (editor, sender, options = {}) => {
  alert(`Hello ${options.some}`);
});

// Run it
editor.runCommand('my-command', { some: 'World' });
```

### Define in initialization
```js
grapesjs.init({
  commands: {
    defaults: [
      {
        id: 'my-command-id',
        run() { alert('This is my command'); },
      },
    ],
  },
});
```

## Stateful Commands (run/stop)

Commands with both `run` and `stop` methods are tracked as active:

```js
editor.Commands.add('my-command-state', {
  run(editor) {
    alert('Active');
    return { activated: new Date() }; // return value stored in active map
  },
  stop(editor) {
    alert('Disabled');
  },
});

editor.runCommand('my-command-state');

// Check state
editor.Commands.isActive('my-command-state'); // true
editor.Commands.getActive(); // { 'my-command-state': { activated: Date } }

// Stop
editor.stopCommand('my-command-state');
```

### Important Behaviors
- **Duplicate prevention:** Running an already active command won't call `run` again. Use `{ force: true }` to override.
- **Stop same logic:** Stopping an already stopped command won't call `stop` again. Use `{ force: true }` to override.
- **UI state coherence:** If your UI (e.g., modal) can close independently, disable the command on close:

```js
editor.Commands.add('my-command-modal', {
  run(editor) {
    editor.Modal.open({
      title: 'Modal',
      content: 'Content',
    }).onceClose(() => this.stopCommand());
  },
  stop(editor) {
    editor.Modal.close();
  },
});
```

## Default Commands

Built-in commands use `core:*` namespace. Get all with `editor.Commands.getAll()`.

| Command | Description |
|---|---|
| `core:canvas-clear` | Clear all content |
| `core:component-delete` | Delete component |
| `core:component-enter` | Select first child |
| `core:component-exit` | Select parent |
| `core:component-next/prev` | Select next/prev sibling |
| `core:component-outline` | Toggle outline borders |
| `core:component-offset` | Show margins/paddings |
| `core:component-select` | Enable canvas selection |
| `core:copy` / `core:paste` | Copy/paste |
| `core:preview` | Preview mode |
| `core:fullscreen` | Fullscreen |
| `core:open-code` | Open code panel |
| `core:open-layers` | Open layers |
| `core:open-styles` | Open style manager |
| `core:open-traits` | Open traits |
| `core:open-blocks` | Open blocks |
| `core:open-assets` | Open assets |
| `core:undo` / `core:redo` | Undo/Redo |

## Extending Commands

### Override
```js
// Same ID = override
editor.Commands.add('my-command-1', editor => {
  alert('Overwritten');
});
```

### Extend
```js
editor.Commands.add('my-command-2', {
  someFunction1() { alert('Function 1'); },
  someFunction2() { alert('Function 2'); },
  run() {
    this.someFunction1();
    this.someFunction2();
  },
});

// Extend only specific methods
editor.Commands.extend('my-command-2', {
  someFunction2() {
    alert('Function 2 extended');
  },
});
```

## Event Hooks

### Per-command events
```js
// After execution
editor.on('command:run:my-command-modal', () => {
  // e.g., add extra content to modal
  const modalContent = editor.Modal.getContentEl();
  modalContent.insertAdjacentHTML('beforeEnd', '<div>Extra</div>');
});

// Before execution
editor.on('command:run:before:my-command-modal', () => {
  console.log('Before execution');
});

// After stop (stateful commands)
editor.on('command:stop:my-command-modal', () => {
  console.log('After stop');
});

// Before stop
editor.on('command:stop:before:my-command-modal', () => {
  console.log('Before stop');
});
```

### Global events (all commands)
```js
editor.on('command:run', commandId => console.log('Run', commandId));
editor.on('command:stop', commandId => console.log('Stop', commandId));
```

## Interrupting Commands

Abort a command before it runs:

```js
editor.on('command:run:before:my-command-modal', options => {
  if (someCondition) {
    options.abort = true;
    console.log('Command aborted');
  }
});
```

Also works with the shorthand event names:
```js
editor.on('run:my-command:before', opts => { opts.abort = 1; });
editor.on('abort:my-command', () => { /* aborted */ });
```
