import Modal from './Modal.jsx'

export default function ConfirmDialog({ title, message, confirmLabel = 'Conferma', onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mb-4 text-sm text-slate-600">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          Annulla
        </button>
        <button
          onClick={onConfirm}
          className="rounded-md bg-rose-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
