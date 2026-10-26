import { Bell, ChevronDown } from 'lucide-react'
import ServerStatus from './ServerStatus'
import { useAuthStore } from '../store/useAuthStore'

// Barra superior blanca: título de la página a la izquierda, usuario a la derecha.
// Props: title y subtitle. El usuario ya no llega por props: se lee del store.
export default function Header({ title, subtitle }) {
  // HOOK: useAuthStore con selector. Se suscribe solo al usuario, no a todo el store.
  const user = useAuthStore((state) => state.user)

  // Sin usuario (sesion recien cerrada) no hay nada que mostrar; ProtectedRoute redirige a /login
  if (!user) return null

  // Iniciales: primera letra de las dos primeras palabras. "Andrés Díaz" -> "AD"
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
  // La API envía el rol como "admin" o "cajero"; aquí se traduce a texto para mostrar
  const roleLabel = user.rol === 'admin' ? 'Administrador' : 'Cajero'

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-8 py-4">
      <div>
        <h1 className="text-2xl font-bold text-dark">{title}</h1>
        <p className="text-sm text-text-secondary">{subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        <ServerStatus />
        <button className="rounded-lg p-2 text-text-secondary hover:bg-background" aria-label="Notificaciones">
          <Bell size={20} />
        </button>
        <div className="h-8 w-px bg-border" />
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-dark text-sm font-semibold text-white">
            {initials}
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-dark">{user.name}</p>
            <p className="text-xs text-text-secondary">{roleLabel}</p>
          </div>
          <ChevronDown size={16} className="text-text-secondary" />
        </div>
      </div>
    </header>
  )
}
