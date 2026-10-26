import { Navigate, Outlet } from 'react-router-dom'

// RUTA PROTEGIDA POR SESION.
// Se usa como "layout route": una <Route> que NO tiene path propio, solo un element.
// Sus rutas hijas solo se muestran si hay un usuario con sesion iniciada.
//
// Props:
//   user -> el usuario logueado (o null si nadie inicio sesion)
export default function ProtectedRoute({ user }) {
  // Sin sesion: <Navigate> cambia la URL a /login.
  // "replace" reemplaza la entrada actual del historial en lugar de agregar una nueva;
  // asi, si el usuario presiona "atras", no vuelve a la pagina protegida que lo rebotaria otra vez.
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Con sesion: <Outlet /> es el "hueco" donde React Router dibuja la ruta hija que coincide
  // con la URL actual (por ejemplo el layout con Sidebar y Header).
  return <Outlet />
}
