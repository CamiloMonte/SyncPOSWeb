import { Navigate, Outlet } from 'react-router-dom'
import { homeFor } from '../utils/homeFor'
import { useAuthStore } from '../store/useAuthStore'

// RUTA PROTEGIDA POR ROL.
// Agrupa las paginas que solo puede ver un rol. ProtectedRoute ya garantizo que hay sesion;
// aqui solo se revisa que el rol del usuario sea el permitido.
//
// Props:
//   allow -> el rol permitido: 'admin' o 'cajero'
// El usuario ya no llega por props: se lee del store.
//
// Ejemplo: <Route element={<RoleRoute allow="admin" />}> ...rutas del admin... </Route>
export default function RoleRoute({ allow }) {
  // HOOK: useAuthStore con selector. Pedimos el usuario completo porque homeFor(user) lo necesita.
  const user = useAuthStore((state) => state.user)

  // Si user es null (sesion recien cerrada), ProtectedRoute redirige a /login;
  // aqui solo evitamos un error mientras React termina de redibujar.
  if (!user) return null

  // Rol incorrecto (por ejemplo un cajero escribe /inventario en la barra de direcciones):
  // se le manda a SU pagina de inicio, no a una pagina de error.
  if (user.rol !== allow) {
    return <Navigate to={homeFor(user)} replace />
  }

  // Rol correcto: se dibuja la pagina hija que coincide con la URL.
  return <Outlet />
}
