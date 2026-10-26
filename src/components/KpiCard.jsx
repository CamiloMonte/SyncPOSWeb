// Tarjeta de indicador (KPI). Los colores dependen de la propiedad "tone".
const tones = {
  success: { badge: 'bg-online-bg text-online-text', icon: 'bg-sena-soft text-sena' },
  info: { badge: 'bg-blue-100 text-blue-700', icon: 'bg-blue-100 text-blue-600' },
  warning: { badge: 'bg-offline-bg text-offline-text', icon: 'bg-offline-bg text-offline' },
  danger: { badge: 'bg-danger-bg text-danger-text', icon: 'bg-danger-bg text-danger' },
}

export default function KpiCard({ title, value, detail, trend, icon: Icon, tone = 'success' }) {
  const colors = tones[tone]

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-text-secondary">{title}</p>
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors.icon}`}>
          {/* "icon" llega como componente; lo usamos como una etiqueta JSX */}
          {Icon && <Icon size={20} />}
        </span>
      </div>
      <p className={`mt-2 text-[28px] font-bold ${tone === 'danger' ? 'text-danger' : 'text-dark'}`}>
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {trend && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors.badge}`}>{trend}</span>
        )}
        <span className="text-xs text-text-secondary">{detail}</span>
      </div>
    </div>
  )
}
