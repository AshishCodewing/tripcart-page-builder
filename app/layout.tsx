import { Geist, Geist_Mono, Inter } from "next/font/google"

// Open Props is the design system's source of truth. Loading it as a global
// side-effect import here makes its variables (`--gray-6`, `--blue-6`,
// `--font-sans`, …) resolve in the outer React UI — preset swatches, panel
// previews, etc. The canvas iframe loads it separately via canvas.styles.
import "open-props/open-props.min.css"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
