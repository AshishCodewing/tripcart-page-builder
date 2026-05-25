import { getPreviewTenantId, getTenantTheme } from "@/lib/cms/tenants"
import { compiledThemeToCss, compileTheme } from "@/lib/theme/compile"

// Shared layout for every preview-only route — the catch-all page
// renderer and the blog preview routes. Reads the `tc-preview-tenant`
// cookie pinned by `/api/preview`, fetches the tenant's brand theme,
// and injects its compiled CSS once for the entire subtree. Per-page
// previews (`PagePreview`) only emit their own page-scoped CSS on top.
//
// This is the server-side mirror of what `designSystemPlugin` does in
// the editor canvas: provide a single `:root` rule and the body /
// element / component defaults so `var(--tc--preset--*)` references
// resolve regardless of which preview route the user landed on.
//
// No draft-mode check here — the underlying pages each call
// `draftMode()` and 404 themselves when it's off. The layout always
// runs above them; emitting a `<style>` block on a 404 render is fine.
export default async function PreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const tenantId = await getPreviewTenantId()
  const themeCss = tenantId
    ? compiledThemeToCss(compileTheme(await getTenantTheme(tenantId)))
    : ""

  return (
    <>
      {themeCss.length > 0 && (
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      )}
      {children}
    </>
  )
}
