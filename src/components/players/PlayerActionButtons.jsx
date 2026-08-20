import { useState } from 'react'
import { useStore } from '../../store.js'

export default function PlayerActionButtons({ player, draftEntry }) {
  const markMine = useStore((s) => s.markMine)
  const markTaken = useStore((s) => s.markTaken)
  const freePlayer = useStore((s) => s.freePlayer)
  const [editingPrice, setEditingPrice] = useState(false)
  const [price, setPrice] = useState('1')

  if (draftEntry) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className={`text-xs font-medium ${draftEntry.status === 'mine' ? 'text-emerald-700' : 'text-slate-500'}`}>
          {draftEntry.status === 'mine' ? `Mio · ${draftEntry.price} cr` : 'Preso'}
        </span>
        <button
          onClick={() => freePlayer(player.id, player.name)}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          Libera
        </button>
      </div>
    )
  }

  if (editingPrice) {
    return (
      <form
        className="flex items-center justify-end gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          markMine(player, price)
          setEditingPrice(false)
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
            if (e.key === 'Escape') setEditingPrice(false)
          }}
          className="w-16 rounded border border-emerald-400 px-1.5 py-1 text-right text-xs focus:outline-none"
        />
        <button type="submit" className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700">
          OK
        </button>
        <button
          type="button"
          onClick={() => setEditingPrice(false)}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
        >
          Annulla
        </button>
      </form>
    )
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        onClick={() => setEditingPrice(true)}
        className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
      >
        Mio
      </button>
      <button
        onClick={() => markTaken(player)}
        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
      >
        Preso
      </button>
    </div>
  )
}
