import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, BarChart3, Receipt, ShoppingCart, ClipboardList, Users as UsersIcon,
} from 'lucide-react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Reports from './pages/Reports'
import SalesHistory from './pages/SalesHistory'
import Users from './pages/Users'
import CashierPos from './pages/CashierPos'
import CashierSales from './pages/CashierSales'
import { api, getSession, clearSession } from './services/api'
import { homeFor } from './utils/homeFor'

// TABLA CENTRAL DE RUTAS.
// Cada rol tiene su lista. De una sola fuente salen tres cosas:
//   1) el menu del Sidebar (path, label, icon)
//   2) el titulo y subtitulo del Header (title, subtitle)
//   3) las <Route> de abajo (path, element)
// Asi, para agregar una pagina solo se toca este arreglo.
// Las URLs van en minusculas y con guiones (kebab-case), en espanol.
const adminRoutes = [
  { path: '/dashboard', label: 'Dashboard General', icon: LayoutDashboard, title: 'Dashboard General', subtitle: 'Lunes, 5 de octubre de 2026 · Resumen del día', element: <Dashboard /> },
  { path: '/inventario', label: 'Inventario y Productos', icon: Package, title: 'Inventario y Productos', subtitle: '248 productos activos · 7 con stock bajo', element: <Inventory /> },
  { path: '/reportes', label: 'Reportes Financieros', icon: BarChart3, title: 'Reportes Financieros', subtitle: 'Rentabilidad del período seleccionado', element: <Reports /> },
  { path: '/historial', label: 'Historial de Ventas', icon: Receipt, title: 'Historial de Ventas', subtitle: 'Inspección de facturas · incluye ventas offline sincronizadas', element: <SalesHistory /> },
  { path: '/usuarios', label: 'Usuarios', icon: UsersIcon, title: 'Gestión de Usuarios', subtitle: 'Cuentas de administradores y cajeros', element: <Users /> },
]

const cashierRoutes = [
  { path: '/punto-de-venta', label: 'Punto de Venta', icon: ShoppingCart, title: 'Punto de Venta', subtitle: 'Caja 1 · Tienda Centro · Turno mañana', element: <CashierPos /> },
  { path: '/mis-ventas', label: 'Mis Ventas del Día', icon: ClipboardList, title: 'Mis Ventas del Día', subtitle: 'Laura Gómez · Caja 1 · Lunes, 5 de octubre de 2026', element: <CashierSales /> },
]

// LAYOUT: la estructura que se repite en todas las paginas internas (Sidebar + Header).
// Es la ruta "padre" de las paginas; la pagina hija se dibuja en <Outlet />.
// Asi el Sidebar y el Header no se vuelven a crear al cambiar de pagina, solo cambia el contenido.
function AppLayout({ user, onLogout }) {
  // HOOK: useLocation devuelve la ruta actual ({ pathname: '/inventario', ... }).
  // Cambia cada vez que la URL cambia, y el componente se vuelve a dibujar con el valor nuevo.
  const location = useLocation()

  // El administrador ve unas paginas y el cajero otras
  const isAdmin = user.rol === 'admin'
  const items = isAdmin ? adminRoutes : cashierRoutes
  // Buscamos en la tabla la ruta que coincide con la URL para sacar el titulo y subtitulo.
  // Es la opcion mas simple: no hay que pasar title/subtitle desde cada pagina.
  const current = items.find((item) => item.path === location.pathname)

  // HOOK: useEffect se ejecuta despues de dibujar y cada vez que cambia "current".
  // Aqui actualiza el titulo de la pestana del navegador segun la pagina abierta.
  useEffect(() => {
    if (current) {
      document.title = `${current.title} · SyncPOS`
    }
  }, [current])

  return (
    <div className="flex h-screen">
      <Sidebar items={items} onLogout={onLogout} isAdmin={isAdmin} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Si la URL no esta en la tabla (current vacio), los textos quedan vacios un instante antes de redirigir */}
        <Header title={current?.title ?? ''} subtitle={current?.subtitle ?? ''} user={user} />

        <main className="flex-1 overflow-y-auto bg-background p-8">
          {/* Outlet: aqui se dibuja la pagina hija que coincide con la URL (Dashboard, Inventory...) */}
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function App() {
  // HOOK: useState guarda quien inicio sesion (null = nadie).
  // Se pasa hacia abajo por props. Para una app mas grande, el siguiente paso seria
  // un Context (AuthContext) para no pasar "user" de componente en componente.
  // Inicializador perezoso: la funcion solo se ejecuta al montar. Lee la sesion guardada
  // en localStorage, asi al recargar la pagina el usuario sigue dentro.
  const [user, setUser] = useState(() => getSession()?.user ?? null)

  // HOOK: useNavigate devuelve una funcion para cambiar de URL desde el codigo
  // (por ejemplo despues de iniciar o cerrar sesion), sin que el usuario haga clic en un enlace.
  const navigate = useNavigate()

  // HOOK: useEffect ejecuta codigo despues de dibujar el componente.
  // Aqui escuchamos el evento que lanza api.js cuando el token vence (error 401).
  useEffect(() => {
    function handleExpired() {
      setUser(null)
      // La sesion ya fue borrada por api.js; mandamos al usuario a /login
      navigate('/login', { replace: true })
    }
    window.addEventListener('syncpos:logout', handleExpired)

    // Funcion de limpieza: React la ejecuta al desmontar el componente.
    // Quita el listener para que no queden escuchas duplicadas o "colgadas".
    return () => window.removeEventListener('syncpos:logout', handleExpired)
  }, [navigate])

  // Se ejecuta cuando el login con la API fue exitoso
  function handleLogin(loggedUser) {
    setUser(loggedUser)
    // replace: true -> /login se reemplaza en el historial, asi "atras" no regresa al formulario
    navigate(homeFor(loggedUser), { replace: true })
  }

  async function handleLogout() {
    try {
      await api.post('/logout') // le pide a Laravel borrar el token
    } catch {
      // Si falla (sin conexion, token vencido) igual cerramos la sesion local
    }
    clearSession()
    setUser(null)
    navigate('/login', { replace: true })
  }

  // ROUTES: revisa la URL actual y dibuja SOLO la <Route> que coincide.
  // Gracias a esto cada pantalla tiene su direccion, el boton "atras" del navegador funciona
  // y se puede recargar o compartir el enlace de una pagina.
  return (
    <Routes>
      {/* /login: si ya hay sesion no tiene sentido ver el formulario, se manda al inicio del rol */}
      <Route
        path="/login"
        element={user ? <Navigate to={homeFor(user)} replace /> : <Login onLogin={handleLogin} />}
      />

      {/* Rutas privadas. ProtectedRoute no tiene path: solo exige sesion y dibuja sus hijas en su Outlet */}
      <Route element={<ProtectedRoute user={user} />}>
        {/* Ruta anidada (nested route): AppLayout pone Sidebar y Header, y las paginas van en su Outlet */}
        <Route element={<AppLayout user={user} onLogout={handleLogout} />}>
          {/* Solo administrador. Si entra un cajero, RoleRoute lo redirige a su inicio */}
          <Route element={<RoleRoute user={user} allow="admin" />}>
            {adminRoutes.map((item) => (
              <Route key={item.path} path={item.path} element={item.element} />
            ))}
          </Route>

          {/* Solo cajero. Si entra un administrador, RoleRoute lo redirige a su inicio */}
          <Route element={<RoleRoute user={user} allow="cajero" />}>
            {cashierRoutes.map((item) => (
              <Route key={item.path} path={item.path} element={item.element} />
            ))}
          </Route>
        </Route>
      </Route>

      {/* "/" -> inicio del rol, o /login si no hay sesion */}
      <Route path="/" element={<Navigate to={user ? homeFor(user) : '/login'} replace />} />

      {/* "*" captura cualquier URL que no exista y la manda a "/", que a su vez decide a donde ir */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
