// Central capability matrix for Library rows — the single source of truth for
// which actions (edit / duplicate / destructive) a template, pattern, or part
// exposes. Pure data (no React, no "use server") so the client data-table and
// the server actions can both import it.
//
// Modeled on the WordPress Site Editor, matching its capabilities:
//
//   Templates  edit ✅  duplicate ✅  delete ✅ (custom) / "Clear customizations"
//                                     (reset) ✅ when a hierarchy template is edited
//   Parts      edit ✅  duplicate ✅  delete ✅ (user) / reset ✅ (theme, edited)
//   Patterns   theme:  locked — duplicate-only → editable user copy
//              user:   edit / duplicate / rename / delete
//
// The destructive action splits on provenance, exactly like WP: a DB row that
// shadows a code/hierarchy default ("shadow") reverts to that default ("Reset"
// / "Clear customizations"); a standalone authored row ("user") hard-deletes.

export type RowKind = "LAYOUT" | "PATTERN" | "PART"

export type RowOrigin =
  // Code-defined (pattern manifest / code part) — no DB row.
  | "builtin"
  // Synthetic placeholder shadowing a code/hierarchy default — no DB row yet.
  | "default"
  // Real DB row shadowing a code/hierarchy default — a customized chrome part
  // (header/footer) or a customized hierarchy template (a "Pages"/"404"/… row).
  // Its destructive action reverts to the default. See `isDefaultShadowSlug`.
  | "shadow"
  // Plain authored DB row (tenant- or globally-scoped) — hard-deletes.
  | "user"

export type RowCapabilities = {
  // How Edit behaves: link straight to the editor (`link`), materialize the
  // shadowed default first then open it (`customize`), or no edit affordance.
  edit: "link" | "customize" | null
  // How Duplicate behaves: clone an existing DB row (`row`), fork a synthetic
  // default into an independent row (`default`), copy a built-in pattern into a
  // tenant pattern (`builtin`), or not duplicable.
  duplicate: "row" | "default" | "builtin" | null
  // The destructive action: hard delete (`delete`), revert a customized chrome
  // part to its code default (`reset`), or nothing to remove.
  destructive: "delete" | "reset" | null
}

const NONE: RowCapabilities = { edit: null, duplicate: null, destructive: null }

export function resolveCapabilities(
  origin: RowOrigin,
  kind: RowKind
): RowCapabilities {
  switch (origin) {
    // Code-defined, read-only. A built-in PATTERN can still be copied into an
    // editable tenant pattern (WP "Copy to My Patterns"); other kinds are inert.
    case "builtin":
      return kind === "PATTERN"
        ? { edit: null, duplicate: "builtin", destructive: null }
        : NONE

    // Synthetic default (not yet materialized): Edit shadows the code/hierarchy
    // default into a DB row. A chrome PART default can also be forked into an
    // independent part (`duplicateDefaultPart` copies the code body); a LAYOUT
    // default has no code body to copy, so it's edit-only — use Edit then
    // Duplicate the materialized row, or "Add new" for a blank template.
    case "default":
      return kind === "LAYOUT"
        ? { edit: "customize", duplicate: null, destructive: null }
        : { edit: "customize", duplicate: "default", destructive: null }

    // Customized default (DB row shadowing a chrome slug or hierarchy template):
    // its destructive action reverts to the default rather than deleting.
    case "shadow":
      return { edit: "link", duplicate: "row", destructive: "reset" }

    // Plain authored row — full edit / duplicate / delete for every kind.
    case "user":
      return { edit: "link", duplicate: "row", destructive: "delete" }
  }
}
