// Single source of truth for the code-defined patterns' inserter metadata
// (id, label, category). Both sides consume it, so they can't drift:
//   - each `register*Block` imports its descriptor and passes
//     `label`/`category` straight into `editor.Blocks.add(d.id, …)`;
//   - the admin /patterns library reads `BUILTIN_PATTERNS` to list the same
//     patterns as read-only "Built-in" rows.
//
// This is WordPress's model — the pattern registry (code) and user patterns
// (DB) merged at read time; code patterns are never copied into the DB.
//
// Why the descriptors live HERE rather than being exported from each pattern
// module: this must be a pure-data module (no grapesjs / editor imports) so
// server components can import it. The pattern modules all import grapesjs, so
// the manifest can't import descriptors *from* them — instead they import
// *from* the manifest. Import this by its full path
// (`@/lib/plugins/patterns/manifest`), NOT via `../patterns` (the index pulls
// in the editor registrations). Block content / media / component-type stay in
// each registration (editor-only); only the shared display metadata is here.

export type BlockDescriptor = {
  /** GrapesJS block id (also used as the display slug in the library). */
  id: string
  /** Inserter label shown in the editor + library. */
  label: string
  /** Inserter category. */
  category: string
}

// ── Per-pattern descriptors (consumed by each register*Block) ──────────────

export const heroDescriptors: BlockDescriptor[] = [
  { id: "tc-hero", label: "Hero", category: "Sections" },
  { id: "tc-hero-minimal", label: "Hero · Minimal", category: "Sections" },
  { id: "tc-hero-announce", label: "Hero · Announce", category: "Sections" },
]

export const aboutDescriptor: BlockDescriptor = {
  id: "tc-about",
  label: "About",
  category: "Sections",
}

export const ctaDescriptor: BlockDescriptor = {
  id: "tc-cta",
  label: "Call to Action",
  category: "Sections",
}

export const cardDescriptors: BlockDescriptor[] = [
  { id: "tc-card-feature", label: "Card · Feature", category: "Cards" },
  { id: "tc-card-stat", label: "Card · Stat", category: "Cards" },
  { id: "tc-card-quote", label: "Card · Quote", category: "Cards" },
]

export const testimonialDescriptor: BlockDescriptor = {
  id: "tc-testimonial",
  label: "Testimonial",
  category: "Sections",
}

export const tripsDescriptor: BlockDescriptor = {
  id: "tc-trips",
  label: "Trip Cards",
  category: "Sections",
}

export const destinationPageDescriptor: BlockDescriptor = {
  id: "tc-page-destination",
  label: "Destination Page",
  category: "Sections",
}

export const pricingPageDescriptor: BlockDescriptor = {
  id: "tc-page-pricing",
  label: "Pricing Page",
  category: "Sections",
}

// ── Aggregate (consumed by the admin /patterns library) ────────────────────

export const BUILTIN_PATTERNS: BlockDescriptor[] = [
  ...heroDescriptors,
  aboutDescriptor,
  ctaDescriptor,
  ...cardDescriptors,
  testimonialDescriptor,
  tripsDescriptor,
  destinationPageDescriptor,
  pricingPageDescriptor,
]
