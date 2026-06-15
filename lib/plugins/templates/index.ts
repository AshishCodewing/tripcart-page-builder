// Built-in LAYOUT templates (WP analog: theme `/templates/*.html`) — full-page
// shells per route/query type. None are code-defined yet: the preview routes
// (`app/preview/[tenantId]/{pages,posts}`) render content directly and the
// site chrome comes from `../parts` (header/footer). When the render paths
// need code-defined layout defaults for reserved slugs (e.g. "404",
// "singular"), add them here as `ProjectDefinition`s and resolve them the same
// way parts are — a DB `Template` (kind LAYOUT) at the slug shadows the code
// default. This file reserves the location and the convention.
//
// Sibling concepts: `../patterns` (editor section-blocks users insert) and
// `../parts` (code-defined header/footer). Mirrors WP's templates/patterns/
// parts split.

export const builtinTemplates: Record<string, never> = {}
