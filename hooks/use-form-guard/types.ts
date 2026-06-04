export interface UseFormGuardOptions {
  /**
   * Whether the form has unsaved changes
   */
  isDirty: boolean

  /**
   * Message shown in the confirmation dialog when the user tries to leave.
   * Note: Modern browsers do not display custom messages in the beforeunload dialog.
   * The message is used for the SPA navigation confirm() dialog.
   * @default 'You have unsaved chagnes. Are you sure you want to leave?
   */
  message?: string

  /**
   * Custom async function to show a confirmation dialog.
   * Return `true` to allow navigation, `false` to prevent it.
   * if not provided, uses the browser's native `window.confirm()`.
   *
   * @example
   * onBlock: () => openMyModal().then(result => result === 'confirm')
   */
  onBlock?: () => Promise<boolean>

  /**
   * Whether the guard is active.
   * Set to `false` to temporarily disable without changing `isDirty`/
   * @default true
   */
  enabled?: boolean

  /**
   * Whether to guard browser tab close / refresh via `beforeunload`.
   * Disable this when another layer already shows a native unsaved-changes
   * prompt on unload (e.g. GrapesJS `noticeOnUnload`), to avoid a double
   * dialog. SPA navigation and back/forward are still guarded.
   * @default true
   */
  guardUnload?: boolean
}

export interface UseFormGuardResult {
  /**
   * Whether navigation is currently being guarded.
   * Equals `isDirty && enabled`.
   */
  isBlocked: boolean

  /**
   * Handler to attach to a Next.js `<Link onNavigate={...}>` (15.3+) — or any
   * call site exposing a `preventDefault`-able navigation event — to guard
   * client-side soft navigation. Prompts with the native `confirm()` and calls
   * `event.preventDefault()` when the guard is armed and the user declines.
   *
   * Synchronous by design: a custom async `onBlock` cannot cancel here, so this
   * always uses `confirm()`. Stable identity (safe in deps / on memo'd links).
   */
  onNavigate: (event: { preventDefault: () => void }) => void
}
