// Content key for React's hoistable-<style> `href` prop: FNV-1a over the
// CSS text, base36-encoded. React dedupes hoisted styles by href and treats
// each href as immutable — it never diffs the tag's content — so the key
// must change whenever the CSS does. Hashing the content itself guarantees
// that, and gives identical CSS (e.g. the same chrome part rendered on two
// surfaces) a single deduped tag for free.

export function cssContentKey(css: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < css.length; i++) {
    hash ^= css.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}
