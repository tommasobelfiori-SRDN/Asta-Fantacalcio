export default function Modal({ title, subtitle, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col border-2 border-ink bg-card shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-ink p-5 pb-3.5">
          <div className="flex min-w-0 flex-col">
            <h2 className="truncate font-serif text-xl font-semibold text-ink">{title}</h2>
            {subtitle && <span className="font-mono text-xs text-muted">{subtitle}</span>}
          </div>
          <button onClick={onClose} className="shrink-0 p-1 text-ink hover:text-granata" aria-label="Chiudi">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13"></path>
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-5 pt-4">{children}</div>
      </div>
    </div>
  )
}
