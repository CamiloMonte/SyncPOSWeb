// Etiqueta pequeña de estado. Recibe "status" y "children" (el texto) como props.
const styles = {
  online: 'bg-online-bg text-online-text',
  success: 'bg-online-bg text-online-text',
  offline: 'bg-offline-bg text-offline-text',
  pending: 'bg-offline-bg text-offline-text',
  danger: 'bg-danger-bg text-danger-text',
  neutral: 'bg-background text-text-secondary',
}

// Solo los estados "online" muestran el punto de color
const dots = {
  online: 'bg-online',
  offline: 'bg-offline',
}

export default function StatusPill({ status = 'online', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {/* Renderizado condicional: el punto solo aparece si existe en "dots" */}
      {dots[status] && <span className={`h-1.5 w-1.5 rounded-full ${dots[status]}`} />}
      {children}
    </span>
  )
}
