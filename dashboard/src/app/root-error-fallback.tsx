/** The outermost error boundary's fallback (see main.tsx) — sits outside every provider
 * (theme, query client, auth, router), so it deliberately imports nothing from the app's own
 * component library. If a provider itself is what crashed, this is the one piece of UI that still
 * has to render correctly regardless. Plain markup + Tailwind utility classes only. */
export function RootErrorFallback() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-center text-neutral-100">
      <div className="flex size-12 items-center justify-center rounded-full bg-red-500/10">
        <svg viewBox="0 0 24 24" fill="none" className="size-6 text-red-400" aria-hidden="true">
          <path
            d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-3l-8.18-14.14a2 2 0 0 0-3.42 0Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-medium">Support Console failed to load</p>
        <p className="max-w-sm text-sm text-neutral-400">
          Something went wrong before the app could start. Reloading usually fixes this.
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
      >
        Reload page
      </button>
    </div>
  )
}
