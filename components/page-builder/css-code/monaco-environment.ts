// Monaco resolves its workers through `new URL(…, import.meta.url)` inside the
// package, which Turbopack copies as a raw asset instead of bundling — the
// worker then fails on its own bare imports. Declaring the workers here as
// `new Worker(new URL(…))` makes them real bundled worker entries.
type MonacoEnvironment = {
  getWorker: (workerId: string, label: string) => Worker
}

export function installMonacoEnvironment() {
  const scope = globalThis as { MonacoEnvironment?: MonacoEnvironment }
  if (scope.MonacoEnvironment) return
  scope.MonacoEnvironment = {
    getWorker(_workerId, label) {
      if (label === "css" || label === "scss" || label === "less") {
        return new Worker(
          new URL("monaco-editor/language/css/css.worker", import.meta.url),
          { type: "module" }
        )
      }
      return new Worker(
        new URL("monaco-editor/editor/editor.worker", import.meta.url),
        { type: "module" }
      )
    },
  }
}
