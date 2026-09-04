import { useState } from 'react'
import { useStore } from '../../store.js'
import TakenForm from './TakenForm.jsx'

export default function PlayerActionButtons({ player, draftEntry }) {
  const markMine = useStore((s) => s.markMine)
  const freePlayer = useStore((s) => s.freePlayer)
  // 'mine' apre il prezzo, 'taken' chiede squadra e prezzo dell'avversario.
  const [editing, setEditing] = useState(null)
  const [price, setPrice] = useState('1')

  if (draftEntry) {
    return (
      <div className="flex items-center justify-end gap-2.5">
        {draftEntry.status === 'mine' && (
          <span className="text-[11px] font-bold uppercase tracking-caps text-campo">
            Mio · {draftEntry.price} cr
          </span>
        )}
        <button
          onClick={() => freePlayer(player.id, player.name)}
          className="h-11 rounded-[2px] border-[1.5px] border-muted px-3.5 text-[11px] font-bold uppercase tracking-caps text-muted hover:border-ink hover:text-ink lg:h-8"
        >
          Libera
        </button>
      </div>
    )
  }

  if (editing === 'taken') {
    return (
      <TakenForm
        player={player}
        layout="inline"
        onDone={() => setEditing(null)}
        onCancel={() => setEditing(null)}
      />
    )
  }

  if (editing === 'mine') {
    return (
      <form
        className="flex items-center justify-end gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          markMine(player, price)
          setEditing(null)
          setPrice('1')
        }}
      >
        <input
          type="number"
          min="1"
          autoFocus
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(null)
          }}
          className="h-11 w-16 rounded-[2px] border-[1.5px] border-campo bg-card text-center font-mono text-[15px] font-semibold text-campo focus:outline-none lg:h-8"
        />
        <button
          type="submit"
          className="h-11 rounded-[2px] bg-campo px-3.5 text-[11px] font-bold uppercase tracking-caps text-paper hover:opacity-90 lg:h-8"
        >
          OK
        </button>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="h-11 rounded-[2px] border-[1.5px] border-muted px-3 text-[11px] font-bold uppercase tracking-caps text-muted hover:border-ink hover:text-ink lg:h-8"
        >
          Esc
        </button>
      </form>
    )
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={() => setEditing('mine')}
        className="h-11 rounded-[2px] bg-ink px-4 text-[11px] font-bold uppercase tracking-caps text-paper hover:opacity-90 lg:h-8"
      >
        Mio
      </button>
      <button
        onClick={() => setEditing('taken')}
        className="h-11 rounded-[2px] border-[1.5px] border-ink px-3.5 text-[11px] font-bold uppercase tracking-caps text-ink hover:bg-ink/5 lg:h-8"
      >
        Preso
      </button>
    </div>
  )
}
