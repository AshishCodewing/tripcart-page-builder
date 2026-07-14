// Base class for TripCart light-DOM web components, built as a REALM FACTORY.
//
// A custom element class must `extend` the HTMLElement of the realm it's
// registered in, and the editor canvas iframe is a different realm from the
// app window. So instead of a single class, we build the class per-realm via
// `tcBase(win)` and register it with `win.customElements`. All realm-sensitive
// globals (HTMLElement, CustomEvent, MutationObserver, …) come from `win`, so
// the same source works in the app window and the canvas iframe with no build
// step — see index.ts `defineInteractive`.

export type Win = Window & typeof globalThis

export function tcBase(win: Win) {
  return class TcBase extends win.HTMLElement {
    #initialized = false

    connectedCallback() {
      if (this.#initialized) return
      if (this.ownerDocument.readyState === "loading") {
        this.ownerDocument.addEventListener("DOMContentLoaded", () => this.#setup(), {
          once: true,
        })
      } else {
        this.#setup()
      }
    }

    #setup() {
      if (this.#initialized) return
      this.#initialized = true
      this.init()
    }

    disconnectedCallback() {
      this.cleanup()
    }

    /** Run once, when connected and the document is ready. Override in subclasses. */
    protected init(): void {}

    /** Optional teardown on disconnect. */
    protected cleanup(): void {}

    /** Whether the element is being edited in the page builder. The GrapesJS
     * type sets the `editing` attribute on the canvas node; preview/published
     * pages omit it, so behavior runs there. */
    protected get isEditing(): boolean {
      return this.hasAttribute("editing")
    }

    /** `EventListenerObject` hook — dispatch to `on<Type>` methods (e.g.
     * "click" → `onClick`). Register with `el.addEventListener(type, this)`. */
    handleEvent(event: Event) {
      const { type } = event
      const method = `on${type.charAt(0).toUpperCase()}${type.slice(1)}`
      const handler = (
        this as unknown as Record<string, ((e: Event) => void) | undefined>
      )[method]
      if (typeof handler === "function") handler.call(this, event)
    }

    /** Roving-focus helper: next index for the pressed key (arrows wrap;
     * Home/End when `homeEnd`), or -1. Calls preventDefault on a match. */
    protected keyNav(
      event: KeyboardEvent,
      idx: number,
      len: number,
      prevKey: string,
      nextKey: string,
      homeEnd = true
    ): number {
      const { key } = event
      let next = -1
      if (key === nextKey) next = (idx + 1) % len
      else if (key === prevKey) next = (idx - 1 + len) % len
      else if (homeEnd && key === "Home") next = 0
      else if (homeEnd && key === "End") next = len - 1
      if (next >= 0) event.preventDefault()
      return next
    }

    protected emit(name: string, detail: unknown = null): boolean {
      return this.dispatchEvent(
        new win.CustomEvent(name, { bubbles: true, cancelable: true, detail })
      )
    }

    protected uid(): string {
      return Math.random().toString(36).slice(2, 10)
    }
  }
}
