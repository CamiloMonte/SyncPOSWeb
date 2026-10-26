import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

// RUTA PROTEGIDA POR SESION.
// Se usa como "layout route": una <Route> que NO tiene path propio, solo un element.
// Sus rutas hijas solo se muestran si hay una sesion iniciada.
//
// Ya no recibe props: antes App.jsx le pasaba "user" (prop drilling). Ahora lee la sesion
// directamente del store de autenticacion.
export default function ProtectedRoute() {
  // HOOK: useAuthStore con selector. Devuelve true/false; el componente solo se vuelve a
  // dibujar cuando ese booleano cambia (no cuando cambia loading o error).
  // La interfaz REACCIONA al store: cuando logout() o un 401 dejan el token en null,
  // este componente se redibuja solo y el <Navigate> manda a /login. Nadie lo avisa por evento.
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated())

  // Sin sesion: <Navigate> cambia la URL a /login.
  // "replace" reemplaza la entrada actual del historial en lugar de agregar una nueva;
  // asi, si el usuario presiona "atras", no vuelve a la pagina protegida que lo rebotaria otra vez.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Con sesion: <Outlet /> es el "hueco" donde React Router dibuja la ruta hija que coincide
  // con la URL actual (por ejemplo el layout con Sidebar y Header).
  return <Outlet />
}
