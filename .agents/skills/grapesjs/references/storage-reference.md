# GrapesJS Storage Deep Dive

## Table of Contents
- Project Data
- Local Storage
- Remote Storage
- Custom Storage
- Inline Storage
- Common Patterns
- Events

## Project Data

The project data is a JSON object with all project info (styles, pages, etc.).

```js
// Get current project data
const projectData = editor.getProjectData();

// Load project data
editor.loadProjectData(projectData);
```

**Important:** Only rely on JSON project data for persistence. HTML/CSS can be used for initial import but never as the persistence layer — it strips component metadata.

## Storage Strategy

Data is auto-stored when `editor.getDirtyCount()` reaches `stepsBeforeSave`. On successful store, the counter resets.

```js
// Manual store/load
const stored = await editor.store();
const loaded = await editor.load();
```

## Local Storage Setup

```js
const projectId = getProjectId();

grapesjs.init({
  storageManager: {
    type: 'local',
    options: {
      local: { key: `gjsProject-${projectId}` },
    },
  },
});
```

## Remote Storage Setup

```js
const projectID = 1;
const projectEndpoint = `http://localhost:3000/projects/${projectID}`;

grapesjs.init({
  storageManager: {
    type: 'remote',
    stepsBeforeSave: 3,
    options: {
      remote: {
        urlLoad: projectEndpoint,
        urlStore: projectEndpoint,
        // Transform fetch options (e.g., change POST to PATCH)
        fetchOptions: opts => (opts.method === 'POST' ? { method: 'PATCH' } : {}),
        // Transform data before store
        onStore: data => ({ id: projectID, data }),
        // Extract project data from response
        onLoad: result => result.data,
      },
    },
  },
});
```

### Server Requirements
- **Load** (`GET`): Return JSON project data directly
- **Store** (`POST`): Expect valid response (status 200)
- Use `options.remote.onLoad` to extract data if response has metadata

## Define Custom Storage

```js
const sessionStoragePlugin = editor => {
  editor.Storage.add('session', {
    async load(options = {}) {
      return JSON.parse(sessionStorage.getItem(options.key));
    },
    async store(data, options = {}) {
      sessionStorage.setItem(options.key, JSON.stringify(data));
    },
  });
};

grapesjs.init({
  plugins: [sessionStoragePlugin],
  storageManager: {
    type: 'session',
    options: { session: { key: 'myKey' } },
  },
});
```

## Extend/Combine Storages

```js
const { Storage } = editor;

Storage.add('remote-local', {
  async store(data) {
    try {
      const remote = Storage.get('remote');
      await remote.store(data, Storage.getStorageOptions('remote'));
    } catch (err) {
      const local = Storage.get('local');
      await local.store(data, Storage.getStorageOptions('local'));
    }
  },
  async load() { /* ... */ },
});
```

## Replace Existing Storage

```js
// Replace remote with axios
editor.Storage.add('remote', {
  async load() { return await axios.get(`projects/${projectId}`); },
  async store(data) { return await axios.patch(`projects/${projectId}`, { data }); },
});
```

## Inline Storage (form-based)

```js
const inlineStorage = editor => {
  const projectDataEl = document.getElementById('project-data');
  const projectHtmlEl = document.getElementById('project-html');

  editor.Storage.add('inline', {
    load() {
      return JSON.parse(projectDataEl.value || '{}');
    },
    store(data) {
      const component = editor.Pages.getSelected().getMainComponent();
      projectDataEl.value = JSON.stringify(data);
      projectHtmlEl.value = `<html>
        <head><style>${editor.getCss({ component })}</style></head>
        ${editor.getHtml({ component })}
      </html>`;
    },
  });
};

grapesjs.init({
  plugins: [inlineStorage],
  storageManager: { type: 'inline' },
});
```

## Common Patterns

### Skip Initial Load
```js
grapesjs.init({
  projectData: existingData || {
    pages: [{ component: '<div class="test">Initial content</div><style>.test { color: red }</style>' }],
  },
  storageManager: { type: 'remote' },
});
```
When `projectData` is defined, the initial storage load is automatically skipped.

### Store HTML/CSS with Project Data
```js
grapesjs.init({
  storageManager: {
    type: 'remote',
    options: {
      remote: {
        onStore: (data, editor) => {
          const pagesHtml = editor.Pages.getAll().map(page => {
            const component = page.getMainComponent();
            return {
              html: editor.getHtml({ component }),
              css: editor.getCss({ component }),
            };
          });
          return { id: projectID, data, pagesHtml };
        },
        onLoad: result => result.data,
      },
    },
  },
});
```

### Disable Autosave with Manual Save Button
```js
grapesjs.init({
  storageManager: { type: 'remote', autosave: false },
  commands: {
    defaults: [
      { id: 'store-data', run: editor => editor.store() },
    ],
  },
});
```

## Events

```js
editor.on('storage:start', () => { /* save/load started */ });
editor.on('storage:end', (type, result) => { /* save/load ended */ });
editor.on('storage:error', error => { /* handle error */ });
```
