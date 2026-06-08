"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"

// Error boundary for the editor routes (page / post / template edit).
//
// The common trigger is a stale editor: the underlying row was deleted
// (or the DB reseeded) after the tab loaded, so the save action's bound
// id resolves to nothing and the server throws "<X> not found." Rather
// than crash with the dev overlay, we replace the unmounted editor with
// a recoverable screen.
//
// NB: Next.js redacts Server Action error messages in production (the
// client only receives a generic string + `digest`), so we can only
// detect the not-found case reliably in development. The copy is written
// to read sensibly either way, and "Try again" + "Back" work regardless.
export default function EditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const missing = /\bnot found\b/i.test(error.message)

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold">
          {missing
            ? "This content no longer exists"
            : "Something went wrong"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {missing
            ? "It may have been deleted in another tab or session, so your changes couldn't be saved. Head back and reopen it from the list."
            : "We couldn't save your changes. Try again, or head back and reopen the editor."}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {!missing && (
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="size-4" />
            Try again
          </Button>
        )}
        <Button size="sm" render={<Link href="/admin/tenants" />}>
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Button>
      </div>
    </div>
  )
}
