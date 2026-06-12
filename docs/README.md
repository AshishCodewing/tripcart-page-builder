# Documentation

## Start here: the Handbook

New to the codebase? Read **[`handbook/`](./handbook)** — the developer onboarding
guide. It explains how the page builder works, one topic at a time, with a concise
doc (the mental model) and a technical doc (a map into the code) for each:

- [Overview & index](./handbook/README.md)
- [Architecture](./handbook/architecture.md)
- [Editor & UI](./handbook/editor-ui.md)
- [React Renderer](./handbook/react-renderer.md)
- [Theming](./handbook/theming.md)
- [Blocks & Patterns](./handbook/blocks-patterns.md)
- [Templates](./handbook/templates.md)
- [Persistence](./handbook/persistence.md)
- [Preview & Publishing](./handbook/preview.md)
- [RAG (Docs Search)](./handbook/rag.md)

## Reference (working docs)

Living design/status docs for in-flight work. These are cited by code comments and by
plans in [`plans/`](../plans) — they track decisions and remaining work, not
onboarding.

| Doc | What it covers |
|---|---|
| [Templates](./reference/templates.md) | Template data-model design: kinds, sync semantics, global-vs-tenant shadowing. |
| [Templates — Remaining Work](./reference/templates-followups.md) | Status tracker + design notes for unfinished templates work (referenced by section number from code + plans). |
| [Page / Post Rendering Pipeline](./reference/rendering-pipeline.md) | Route → DB → template-resolution → JSON→JSX flow for the public render. |
