import Modal from './Modal.jsx'

export default function ConfirmDialog({ title, message, confirmLabel = 'Conferma', onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mb-5 text-sm leading-relaxed text-muted">{message}</p>
      <div className="flex justify-end gap-2.5">
        <button
          onClick={onCancel}
          className="h-9 rounded-[2px] border-[1.5px] border-ink px-4 text-[11px] font-bold uppercase tracking-caps text-ink hover:bg-ink/5"
        >
          Annulla
        </button>
        <button
          onClick={onConfirm}
          className="h-9 rounded-[2px] bg-granata px-4 text-[11px] font-bold uppercase tracking-caps text-paper hover:opacity-90"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
