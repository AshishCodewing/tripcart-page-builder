# Header & Footer: Two Ways to Build It

> **Outcome (2026-06-15).** We chose **A's spirit — the site owns the chrome** —
> but in its **simplest form**: one header + one footer per tenant, rendered
> once in the preview route layout. We did *not* build the elaborate version
> of A (per-page "zones", a region-routing proxy, per-page layout assignment,
> a content slot) — that was prototyped under "Approach A / §14" and fully
> reverted as over-engineered. We also did not keep B (each page bakes the
> whole document). Concretely: `Tenant.headerTemplateId` / `footerTemplateId`
> point at header/footer templates, which `app/preview/[tenantId]/layout.tsx`
> renders around the page. The A-vs-B comparison below is kept for context;
> "Zones" remain a *possible future* extension, not something we built.

Audience: product. Plain-language comparison of two architectures for shared
headers/footers, written for the chrome-ownership decision. Technical
counterpart: `wp-template-hierarchy.md` and `templates-followups.md` §14.

## The question to decide

When a visitor's site shows a header and footer on every page, **who owns
them — the site, or each page?** This sounds technical, but it's a product
decision, because each answer makes a different promise to our users.

- **Approach A — the site owns them.** Think of a picture frame: the header
  and footer are the frame, and navigating the site swaps the picture inside
  the frame. Every page shares the one frame (or one of a small, fixed set of
  frames — see "Zones" below).
- **Approach B — each page owns them** *(the currently planned design)*.
  Think of a printed brochure: every page is a complete sheet, top to bottom,
  with the header and footer printed on each one. They look identical because
  they come from the same shared template — but each page carries its own
  copy of the result.

In both approaches the user edits the header **once** and it changes
everywhere. The difference is what happens behind the scenes — and one
visible product capability.

## What each approach provides and loses

| | A — site owns chrome | B — each page is complete (planned) |
|---|---|---|
| Edit header once, updates whole site | Yes | Yes |
| A page can have a **different** header, or none | **Only for page *types* we build into the product** (see "Zones" below) — never a per-page toggle the user controls | **Yes — any individual page can vary or drop the chrome** |
| Menus/drawers stay open while visitor moves between pages (e.g. a cart panel that doesn't close on navigation) | Yes | No — chrome rebuilds on each page change |
| Moving between pages | Slightly lighter (only the middle of the page travels) | Slightly heavier, but preloading makes it feel equally instant |
| Publishing a header edit on a large site | Instant — one thing updates | Every page of the site must refresh its stored copy |

## Zones: how A still handles checkout and landing pages

A's "one frame per site" rule sounds like it forbids the obvious asks — a
checkout page without navigation, a landing page with no header. It doesn't,
as long as those are **page types**, not per-page choices. Here's the
distinction and why it exists.

Under A, the frame can't be removed from inside: a page lives *inside* the
frame and has no way to reach out and hide it. (This isn't our code's
limitation — it's how the underlying framework works, and it's the same
mechanism that makes A fast.) What the framework *does* allow is for the site
to have **more than one frame, side by side** — think of a hotel: the lobby,
the spa, and the parking garage each have their own fixed look, and walking
between them switches you from one to another. We can build the site with a
small set of such **zones**:

- **Standard zone** — the tenant's normal header and footer (most pages).
- **Checkout zone** — slim, logo-only header, no navigation to leak the
  visitor out of the purchase funnel. Still tenant-editable.
- **Bare zone** — no chrome at all, for landing-page-type pages.

Each zone's chrome is still edited once and applies zone-wide, and tenants
can still customize each zone's chrome. Two things to understand about the
trade:

1. **The zone list is a product decision, shipped by us.** Adding a new zone
   is an engineering change, like adding a feature — not something a user
   does. Users choose which zone a page belongs to from the menu we offer;
   they cannot invent "this one page, but with a different header."
2. **Crossing a zone boundary swaps the frame.** Moving from a normal page
   into checkout rebuilds the chrome — which is fine, because entering a
   funnel *is* a context switch. Within a zone, all of A's speed and
   smoothness applies.

So zones soften A's hard rule into: **"one header per site, plus a curated
menu of special page types."** That covers checkout and "landing page without
nav" — the two most common asks. What it can never cover is arbitrary
per-page freedom, which only B provides.

## Performance, in plain terms

**First visit: identical.** A visitor landing on the site does the same amount
of work either way. No measurable difference.

**Clicking between pages: effectively identical to the eye.** A is technically
lighter (it re-sends only the middle of the page; B re-sends the whole page),
but our pages preload before the visitor clicks, so both feel instant. The
real difference here is the *state* one above — in B, anything open in the
header closes when the visitor navigates.

**Editing the header: this is the one that grows with site size.** In A,
saving a header edit updates one shared piece — done, whether the site has 5
pages or 5,000. In B, every page holds its own assembled copy, so a header
edit means every page's stored copy must be refreshed — like reprinting the
whole brochure because the logo moved. Invisible on small sites; on large
busy sites it can cause a brief slow period right after publishing a header
change. This is manageable with engineering work (it's what the entire
WordPress caching industry exists to do — see below), but in A the problem
simply doesn't exist.

## The WordPress precedent

Approach B is how WordPress has always worked, and a large share of the web
runs on it — so B is proven at scale. But it only scales *with* the caching
machinery the WP ecosystem spent two decades building, and WP's own newest
work (region-based navigation) is moving it toward A. We'd be choosing B
knowing where its road leads, or choosing A and skipping the trip.

## The asymmetry that should drive the decision

Almost all of A's performance advantages can be **added to B later** with
engineering work. B's one product advantage — **arbitrary per-page chrome
control — can never be added to A.** It's blocked by how the underlying
framework works, not by effort. Zones recover the common *cases* (checkout,
bare landing pages) but only as a fixed menu we ship, not as user freedom.

So the decision reduces to one product question:

> **Is a curated menu of page types enough — standard, checkout,
> chrome-less landing — or do customers need to change/remove the header on
> any individual page they choose?**

- **A fixed menu is enough** → A (with zones) is the simpler, faster,
  lower-maintenance architecture, and we should switch before more of B is
  built. New special page types become product features we ship.
- **Per-page freedom is the product** → stay with B (current plan). Accept
  the publish-time cost and budget the caching work as sites grow.

## Current status

B is the planned and partially built design. Switching to A is feasible now
at moderate cost (editor preview work + migrating existing page data); the
cost grows the longer we build on B. No-regret work that is identical under
both (template editing, content slots, caching foundations) continues
regardless of this decision.
