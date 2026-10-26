import { X } from 'lucide-react'

// Panel lateral derecho de 480px. Se muestra solo cuando "open" es true.
export default function Drawer({ open, title, onClose, children }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-dark/50">
      <div className="flex h-full w-[480px] max-w-full flex-col bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-6">
          <h2 className="text-lg font-semibold text-dark">{title}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-dark" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
