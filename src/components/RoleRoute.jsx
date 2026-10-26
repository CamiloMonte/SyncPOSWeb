import { Navigate, Outlet } from 'react-router-dom'
import { homeFor } from '../utils/homeFor'

// RUTA PROTEGIDA POR ROL.
// Agrupa las paginas que solo puede ver un rol. ProtectedRoute ya garantizo que hay sesion;
// aqui solo se revisa que el rol del usuario sea el permitido.
//
// Props:
//   user  -> el usuario logueado
//   allow -> el rol permitido: 'admin' o 'cajero'
//
// Ejemplo: <Route element={<RoleRoute user={user} allow="admin" />}> ...rutas del admin... </Route>
export default function RoleRoute({ user, allow }) {
  // Rol incorrecto (por ejemplo un cajero escribe /inventario en la barra de direcciones):
  // se le manda a SU pagina de inicio, no a una pagina de error.
  if (user.rol !== allow) {
    return <Navigate to={homeFor(user)} replace />
  }

  // Rol correcto: se dibuja la pagina hija que coincide con la URL.
  return <Outlet />
}
