/** Row-shaped placeholders while the board loads. */
export default function RecruitingLoading() {
  return (
    <div className="space-y-7" aria-busy="true" aria-label="Loading the board">
      <div className="max-w-[60ch] space-y-3">
        <div className="h-9 w-3/4 rounded-lg bg-surface-2" />
        <div className="h-4 w-full rounded bg-surface-2" />
      </div>
      <div className="h-9 w-64 rounded-lg bg-surface-2" />
      <div className="space-y-3 motion-safe:animate-pulse">
        {[0, 1, 2].map(i => (
          <div key={i} className="panel grid overflow-hidden md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)_400px]">
            <div className="h-24 bg-surface-2 md:h-[140px]" />
            <div className="space-y-3 p-5">
              <div className="h-5 w-40 rounded bg-surface-2" />
              <div className="h-4 w-2/3 rounded bg-surface-2" />
              <div className="h-6 w-1/2 rounded bg-surface-2" />
            </div>
            <div className="hidden border-l border-line p-6 lg:block">
              <div className="h-full rounded-lg bg-surface-2/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
