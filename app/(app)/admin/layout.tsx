// Admin is entirely request-time, DB-backed data — never prerender it.
export const dynamic = "force-dynamic"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
