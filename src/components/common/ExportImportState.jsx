import { useRef } from 'react'
import { useStore } from '../../store.js'

export default function ExportImportState() {
  const exportState = useStore((s) => s.exportState)
  const importState = useStore((s) => s.importState)
  const fileInputRef = useRef(null)

  const handleExport = () => {
    const data = exportState()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fantacalcio-asta-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      importState(data)
    } catch (err) {
      alert('File non valido: ' + err.message)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleExport} className="text-slate-500 hover:text-emerald-700">
        Esporta stato
      </button>
      <button onClick={handleImportClick} className="text-slate-500 hover:text-emerald-700">
        Importa stato
      </button>
      <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} className="hidden" />
    </div>
  )
}
