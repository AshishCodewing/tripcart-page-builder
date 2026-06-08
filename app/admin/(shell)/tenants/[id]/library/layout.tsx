import { LibraryChrome } from "./library-chrome"

export default async function LibraryLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  // The parent tenant layout already validates the tenant (getTenantById +
  // notFound), so we only need the id here to scope the create action.
  const { id } = await params

  return <LibraryChrome tenantId={id}>{children}</LibraryChrome>
}
