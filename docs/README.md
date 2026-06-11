# Documentation

Project docs are split into two tiers:

- **[`guides/`](./guides)** — concise, human-readable overviews. Start here to
  understand a system end-to-end.
- **[`reference/`](./reference)** — deep dives into the implementation: data
  models, request flows, design decisions, and remaining work.

New to the codebase? Read the guides first, then drop into the reference docs
for the area you're touching.

---

## Guides (start here)

| Doc | What it covers |
|---|---|
| [Theming — A Developer's Guide](./guides/theming-guide.md) | How theming works, how Open Props is used, and what a new dev needs to know. |
| [Rendering the JSON](./guides/json-rendering.md) | GrapesJS's canonical `getHtml`/`getCss`/`getProjectData` export vs. why we built our own React renderer. |

## Reference (deep dives)

### Theming
| Doc | What it covers |
|---|---|
| [The Theme Document](./reference/theme-document.md) | The per-tenant theme JSON shape, field by field (modeled on WP `theme.json`). |
| [Preview Theme CSS: Request Flow](./reference/preview-theme-css-flow.md) | How a preview render fetches compiled theme CSS via the versioned-URL cache. |
| [CSS Architecture: Internal vs External](./reference/css-publish-architecture.md) | Where CSS is inlined vs linked at publish time, and the `protected`-rule discipline. |
| [Theme Document Quiz](./reference/theme-document-quiz.md) | Self-check questions on `lib/tokens/index.ts` and the token system. |

### Rendering
| Doc | What it covers |
|---|---|
| [Page / Post Rendering Pipeline](./reference/rendering-pipeline.md) | Full route → DB → template-resolution → JSON→JSX flow for the public render. |
| [Tailwind + GrapesJS Blocks Architecture](./reference/tailwind-blocks-architecture.md) | How Tailwind-styled blocks are authored, registered, and rendered. |

### Templates
| Doc | What it covers |
|---|---|
| [Templates](./reference/templates.md) | The template data model: kinds, sync semantics, global-vs-tenant shadowing. |
| [Create-template-from-scratch UI](./reference/create-template-ui.md) | The Library admin browse + create flow (§3 implementation guide). |
| [Templates — Remaining Work](./reference/templates-followups.md) | Status tracker + design notes for the unfinished templates work. |
