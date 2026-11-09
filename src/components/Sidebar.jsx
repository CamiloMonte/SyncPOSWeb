import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'

// Menu lateral oscuro.
// Props: items (lista del menu: { path, label, icon }), isAdmin
// onLogout ya no llega por props: la accion logout se toma directamente del store.
export default function Sidebar({ items, isAdmin }) {
  // HOOK: useAuthStore con selector. Las acciones del store no cambian de identidad,
  // asi que seleccionar logout no provoca re-dibujos.
  const logout = useAuthStore((state) => state.logout)

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-dark">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-dark-2 p-6">
        {/* Las imagenes de la carpeta "public" se usan con una ruta que empieza en "/" */}
        <img src="/syncpos-icon.png" alt="Logo de SyncPOS" className="h-10 w-10 rounded-lg" />
        <div>
          <p className="text-lg font-bold text-white">SyncPOS</p>
          <p className="text-xs text-muted">Panel Administrativo</p>
        </div>
      </div>

      {/* Opciones: se genera un enlace por cada elemento con map() */}
      <nav className="flex-1 space-y-1 p-4">
        <p className="mb-2 px-3 text-xs font-medium tracking-wider text-muted">
          {isAdmin ? 'MENÚ PRINCIPAL' : 'CAJA'}
        </p>
        {items.map((item) => {
          const Icon = item.icon
          return (
            // NavLink es un <Link> que sabe si su "to" coincide con la URL actual.
            // Cambia la URL sin recargar la pagina. Su className puede ser una funcion:
            // React Router le pasa { isActive } (true cuando este enlace es la pagina abierta)
            // y asi pintamos el fondo verde solo en la opcion activa.
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  isActive ? 'bg-sena text-white' : 'text-muted hover:bg-dark-2'
                }`
              }
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* Tarjeta informativa inferior y cierre de sesion */}
      <div className="space-y-3 p-4">
        <div className="rounded-lg bg-dark-2 p-4">
          {isAdmin ? (
            <>
              <p className="text-xs font-medium text-muted">Dispositivos POS</p>
              <p className="mt-1 text-sm font-semibold text-white">3 de 4 en línea</p>
              <p className="mt-1 text-xs text-muted">12 ventas offline sincronizadas hoy</p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-muted">Turno actual</p>
              <p className="mt-1 text-sm font-semibold text-white">Caja abierta</p>
              <p className="mt-1 text-xs text-muted">07:00 a. m.</p>
            </>
          )}
        </div>
        {/* Cerrar sesion no es una pagina: es una accion, por eso es un <button> y no un NavLink */}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-dark-2"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
