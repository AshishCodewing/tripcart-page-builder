-- Slim Template.data from a full ProjectDefinition
-- (`{ pages: [{ frames: [{ component }] }], styles, ... }`) down to
-- `{ component, styles }`. Templates are conceptually a component +
-- its styles; the project-wrapper layers were dead weight that every
-- reader had to walk through (`pages[0].frames[0].component`).
--
-- See §9 of docs/templates-followups.md for the rationale and the
-- corresponding code changes in saveTemplate, createTemplateFromSelection,
-- and resolvePageTree.
--
-- Idempotent — only reshape rows that still carry the legacy `pages`
-- shape. Already-slim rows (e.g., new conversions written between
-- code deploy and migration run) are skipped.
UPDATE "templates"
SET "data" = jsonb_build_object(
  'component', "data" #> '{pages,0,frames,0,component}',
  'styles',    coalesce("data" -> 'styles', '[]'::jsonb)
)
WHERE jsonb_typeof("data" -> 'pages') = 'array'
  AND "data" #> '{pages,0,frames,0,component}' IS NOT NULL;
