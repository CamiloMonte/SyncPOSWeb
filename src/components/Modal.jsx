import { X } from 'lucide-react'

// Ventana emergente centrada. Si "open" es false no se dibuja nada.
export default function Modal({ open, title, subtitle, onClose, children, footer }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface shadow-xl">
        <div className="flex items-start justify-between border-b border-border p-6">
          <div>
            <h2 className="text-lg font-semibold text-dark">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-text-secondary">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-dark" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        {/* "children" es todo lo que se escribe dentro de <Modal>...</Modal> */}
        <div className="p-6">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-border p-6">{footer}</div>}
      </div>
    </div>
  )
}
