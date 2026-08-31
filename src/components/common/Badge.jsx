// Quadratino ruolo in stile almanacco: dimensioni dal chiamante, colori da roles.js.
export default function Badge({ className = '', children, title }) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center justify-center border-[1.5px] font-extrabold uppercase ${className}`}
    >
      {children}
    </span>
  )
}

// Medaglione tondo "R" per i rigoristi (pieno = titolare, bordo = seconda scelta).
export function PenaltyMedallion({ badge }) {
  if (!badge) return null
  return (
    <span
      title={badge.title}
      className={`inline-flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-[10px] font-extrabold ${badge.className}`}
    >
      R
    </span>
  )
}

// Chi è fermo adesso. Croce da infermeria per l'infortunio, × per la squalifica,
// ! per la diffida (a rischio, ma in campo): si legge scorrendo il listone.
export const STATUS_MARKS = {
  infortunato: { glyph: '+', label: 'Infortunato', className: 'border-granata bg-granata text-paper' },
  squalificato: { glyph: '×', label: 'Squalificato', className: 'border-granata text-granata' },
  diffidato: { glyph: '!', label: 'Diffidato', className: 'border-ocra text-ocra' },
}

export function StatusMedallion({ status }) {
  const mark = status && STATUS_MARKS[status.tipo]
  if (!mark) return null
  return (
    <span
      title={status.nota ? `${mark.label} · ${status.nota}` : mark.label}
      className={`inline-flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-[11px] font-extrabold leading-none ${mark.className}`}
    >
      {mark.glyph}
    </span>
  )
}

// Tag di convenienza: pallino + etichetta + rapporto, niente pillole colorate.
export function ConvenienceTag({ tier, ratioText }) {
  if (!tier) return null
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tier.className}`}>
      <span className={`h-[7px] w-[7px] rounded-full ${tier.dot}`}></span>
      {tier.label}
      {ratioText && <span className="font-mono">{ratioText}</span>}
    </span>
  )
}
