import BlocksScreen from "./blocks-screen"

// The tenant's theme arrives through `themeStore`, hydrated by the layout's
// `TenantThemeEditor`; nothing on this page needs it at request time.
export default function TenantThemeBlocksPage() {
  return <BlocksScreen />
}
