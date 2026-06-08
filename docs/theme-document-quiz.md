# Questions to test your understanding of `lib/tokens/index.ts`

Work through these in order — they go from easy to hard. Answers are at the bottom so you can self-check.

---

## Warm-up (the basics)

1. What is a `Token`? Name its three fields and what each one is for.
2. Why is the `slug` field "write-once" — what would break if you renamed one?
3. What does `defaultTheme` represent in plain English?
4. What's the difference between `defaultTheme.settings` and `defaultTheme.styles`?
5. Why are values like `"hsl(var(--blue-6-hsl))"` and `"var(--font-size-1)"` used instead of just hardcoding `"#3B82F6"` or `"14px"`?

---

## A bit deeper

6. The `borderStyles` array uses values like `"solid"` and `"dashed"` instead of `var(...)` references. Why is that the only category that does this?
7. What does `defaultActivePresetId` track, and why does it live separately from `defaultTheme`?
8. If a user manually edits the primary color, what happens to `activePresetId.color`?
9. In the `styles` section, what does the string `"var:preset|color|primary"` actually represent? Where does it eventually turn into real CSS?

---

## HYDRATABLE and the hydration flow

10. In one sentence: what problem does `HYDRATABLE` solve?
11. What does the `pick` function inside each HYDRATABLE entry return? What does it take as input?
12. If you added a new token category to the schema — say `transition` durations — what would happen if you *forgot* to add an entry to `HYDRATABLE`?
13. Why is the `font-size` entry in HYDRATABLE the only one that has an `as Token[]` cast?
14. Could `HYDRATABLE` be replaced with a single hardcoded loop? What would you lose if you did that?

---

## `tokensFromStored` — line by line

15. Why does `tokensFromStored` start with `structuredClone(base)` instead of mutating `base` directly?
16. If `styles` contains a key like `"--tc--preset--color--primary"` but its value is an empty string `""`, will the token get updated? Why or why not?
17. If `defaultTheme.settings.color.palette` has 22 tokens but the saved `styles` blob only contains values for 3 of them, what does the returned theme look like?
18. Could `tokensFromStored` accidentally *add* a new token that didn't exist in `base`? Why or why not?

---

## Connecting the dots (harder)

19. Walk through what happens, in order, when a user opens a page they last saved a week ago. Which functions in this file get called, with what inputs, and in what sequence?
20. If `defaultTheme` is exported and held by reference somewhere in the app, why is the `structuredClone` in `tokensFromStored` important for *that other code*, not just for the hydration function?
21. Suppose someone adds a brand-new color token to `colorPalette` (say, `tertiary`) and ships it. A user reopens an older project that was saved before the new token shipped. What value will the `tertiary` token have in their hydrated theme, and why?
22. Why is `defaultTheme.styles` populated with references like `var:preset|color|primary` instead of being left empty (the way an earlier version of this file had it)?
23. If you wanted to make `tokensFromStored` also restore the user's `defaultActivePresetId` selections, what extra information would the function need? Why can't it figure that out from `styles` alone?

---

## Answers

<details>
<summary>Click to expand</summary>

1. `slug` (stable ID, used in CSS var names and references), `name` (human label in the UI), `value` (the CSS value).
2. The slug appears in CSS variable names *and* in `styles` references like `var:preset|color|primary`. Renaming it would invalidate every authored reference — buttons, headings, exported HTML, saved page blobs — and there's no automatic migration.
3. The bundled starting design system: every default token plus the default style application for body, headings, buttons, and links.
4. `settings` is the *registry* of available tokens (the palette). `styles` is the *application* — how those tokens get used to style the page by default.
5. So the design system has a swappable baseline. Open Props is the source of truth for sizing/color steps; changing those cascades through the whole theme instead of needing to update each token by hand.
6. Open Props doesn't ship border-style tokens, so there's nothing to reference — we just use the raw CSS keywords.
7. It tracks **which named preset is currently selected per category** in the UI. It's separate because the theme document only stores token *values*; it can't reliably reverse-engineer "these values came from the Blue preset" since values could match a preset by coincidence or two presets could share values.
8. `setToken` in `theme-store.ts` calls `clearActiveFor("color", …)`, which removes the `color` entry from `activePresetId`. The Presets panel then shows no color preset as selected — which is honest, because the values no longer match any named preset.
9. It's a *placeholder* understood by the compiler. `compileTheme` resolves it into the real CSS variable reference `var(--tc--preset--color--primary)` when generating canvas CSS.
10. It avoids 11 near-identical loops by capturing the only thing that varies between categories — the category name and where the tokens live in the theme tree.
11. Input: a `Theme` draft. Output: the `Token[]` for that category, or `undefined` if the theme doesn't have that section.
12. Saved values for that category would silently be ignored on reload — the user would see their customizations disappear after a refresh.
13. `fontSizes` is typed as `FontSizeToken[]`, which is `Token` *plus* an optional `fluid` field. The hydration loop only writes to `value`, so casting away the extra field is safe. Other categories are already `Token[]`.
14. Yes, you could write one big inline loop. You'd lose the ability to add a category in one line — every addition would mean copy-pasting another inner loop. The lookup-table approach makes the pattern explicit and the extension point obvious.
15. To avoid mutating shared state. `defaultTheme` is exported and used elsewhere; if `tokensFromStored` mutated it in place, every other consumer would see the user's saved overrides bleed into their copy of the defaults.
16. No — the guard `stored.length > 0` skips empty strings, so the token keeps its default value. (Empty strings are treated as "no value stored.")
17. A theme with 22 color tokens, 3 of which have the saved values and 19 of which still hold the bundled defaults from `colorPalette`.
18. No. The outer loop only iterates over tokens that *already exist* in the base theme. Keys in `styles` that don't correspond to any base token are simply ignored.
19. (a) The app reads the tenant's theme from the DB (or `defaultTheme` if empty). (b) The page-builder loads a saved GrapesJS project; that project has a stored `:root` rule with CSS variable values. (c) `tokensFromStored(theme, storedRootStyles)` is called to overlay those saved values on top of the theme. (d) The result is used as the active `Theme` for compilation.
20. Because `defaultTheme` is exported from the module and held by reference. Without the clone, mutating `next.settings.color.palette[i].value` would mutate the literal default array — every future consumer of `defaultTheme` would see polluted values for the rest of the process lifetime.
21. It will have whatever value is in `colorPalette` for `tertiary` — the new default — because the saved blob has no key for it, so the loop's `if (stored …)` guard fails and the default is left in place.
22. Without populated `styles`, the new compiler's styles path produces no CSS rules — so headings, buttons, and links would have no default styling on first run. Populating it gives users a visible starting design instead of an empty canvas.
23. It would need the saved `activePresetId` blob persisted *alongside* `styles`. Token values alone can't tell you "the user picked the Blue preset" because (a) a user can hand-edit a token's value to coincidentally match a preset's value, and (b) two presets could share token values. Without that extra metadata, you can only show "no preset selected" honestly.

</details>

---

Aim for getting **most of 1–9 right** before worrying about the harder ones. If you can confidently answer 10–18, you've internalized how the hydration step works. The 19–23 cluster is "do you see how this file connects to the rest of the app" — those are worth thinking through but don't beat yourself up if a few feel fuzzy.
