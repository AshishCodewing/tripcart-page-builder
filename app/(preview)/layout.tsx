import { Geist_Mono, Inter } from "next/font/google"

// Root layout for the preview route group (`/preview/*`).
//
// Preview renders the tenant's *built* page as a site visitor would see it, so
// it deliberately does NOT load the builder app's CSS. This layout is a second
// root layout (Next.js "Multiple Root Layouts" — route groups each own their
// own <html>/<body>), which is the only way to keep `app/globals.css`
// (Tailwind + shadcn) off the preview document. The app UI lives under the
// sibling `(app)` group, which imports Tailwind; nothing here does.
//
// What preview DOES need:
//   - Open Props tokens — the compiled tenant theme references them directly
//     (`hsl(var(--gray-0-hsl))`, `var(--size-3)`, `var(--font-neo-grotesque)`,
//     …), so the theme CSS is meaningless without these variables in scope.
//   - The `--font-sans` / `--font-mono` variables — some font-family presets
//     resolve to `var(--font-sans)`; next/font supplies both the variable and
//     the loaded font files.
//
// The tenant theme stylesheet, the draft gate, and site chrome are layered on
// per-tenant / per-segment below, in `preview/[tenantId]/...`.
import "open-props/open-props.min.css"
import "open-props/colors-hsl.min.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function PreviewRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fontMono.variable}`}
      // Sans fallback + smoothing, replacing what Tailwind's preflight used to
      // provide. Set on <html> (not <body>) so the theme's own body font-family
      // rule wins by normal inheritance when a tenant picks a font.
      style={{
        fontFamily: "var(--font-sans)",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      <body>{children}</body>
    </html>
  )
}
