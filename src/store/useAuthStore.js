import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../services/api'

// =====================================================================
// STORE: useAuthStore  (sesion del usuario)
// ---------------------------------------------------------------------
// PROPOSITO
//   Guardar en UN solo lugar quien inicio sesion y con que token. Antes, App.jsx
//   tenia el usuario en un useState y lo pasaba por props a Header, Sidebar,
//   ProtectedRoute y RoleRoute (prop drilling), y api.js leia el token con helpers
//   propios de localStorage. Ahora todos leen este store.
//
// ESTADO
//   user    -> { id, name, email, rol } o null si nadie inicio sesion
//   token   -> texto que entrega Laravel (Sanctum) o null
//   loading -> true mientras se espera la respuesta de POST /login
//   error   -> mensaje de error del ultimo intento de login ('' = sin error)
//
// ACCIONES
//   login(email, password)  -> pide el token a la API; devuelve true/false
//   logout()                -> avisa a la API (si puede) y borra la sesion local
//   logoutLocal()           -> solo borra la sesion local (la usa api.js en un 401)
//   isAuthenticated()       -> true si hay token y usuario
//   clearError()            -> limpia el mensaje de error
//
// QUIEN LO USA
//   Login, Header, Sidebar (via App), ProtectedRoute, RoleRoute, App (rutas), Users
//   y services/api.js (que lo lee fuera de React con getState()).
// =====================================================================

// Llaves que usaba la version anterior (los helpers de sesion de api.js).
// Ya no se usan: las borramos una sola vez al cargar este archivo para que no queden
// datos viejos (token y usuario) olvidados en el navegador.
localStorage.removeItem('syncpos_token')
localStorage.removeItem('syncpos_user')

// STORE: create() recibe una funcion (set, get) y devuelve un HOOK (useAuthStore).
//   set(...) -> cambia el estado. Zustand mezcla (merge) lo que le pasamos con el estado
//               actual, asi que basta con enviar solo los campos que cambian.
//               Nunca se modifica el estado directamente (inmutabilidad): se envia un
//               objeto NUEVO y los componentes suscritos se vuelven a dibujar.
//   get() -> lee el estado actual dentro de una accion (por ejemplo para isAuthenticated).
//
// persist (middleware) guarda parte del estado en localStorage y lo recupera al recargar
// la pagina. Asi la sesion sigue activa despues de un F5.
export const useAuthStore = create(
  persist(
    (set, get) => ({
      // ---- Estado inicial ----
      user: null,
      token: null,
      loading: false,
      error: '',

      // ---- Acciones ----

      // Inicia sesion contra Laravel. Devuelve true si salio bien y false si fallo,
      // para que el componente decida a donde navegar (el store no conoce el router).
      login: async (email, password) => {
        set({ loading: true, error: '' })
        try {
          // POST /login: la API devuelve { token, user } (el rol lo define el servidor)
          const { token, user } = await api.post('/login', { email, password })
          set({ user, token, loading: false })
          return true
        } catch (err) {
          // Muestra el mensaje de la API (por ejemplo "Credenciales incorrectas.")
          set({ loading: false, error: err.message })
          return false
        }
      },

      // Cierra la sesion. Es "best effort": primero intenta avisar a Laravel para que borre
      // el token en el servidor, pero si falla (sin conexion, token vencido) igual se
      // cierra la sesion local. Nunca lanza error.
      logout: async () => {
        try {
          await api.post('/logout')
        } catch {
          // Se ignora: lo importante es limpiar la sesion en este navegador
        }
        get().logoutLocal()
      },

      // Borra la sesion SOLO en este navegador (no llama a la API).
      // api.js usa esta version cuando recibe un 401: si llamara a logout() intentaria
      // POST /logout con un token invalido, recibiria otro 401 y entraria en un ciclo infinito.
      logoutLocal: () => set({ user: null, token: null, error: '' }),

      // Pregunta derivada: no se guarda como estado, se calcula con get() cada vez.
      // OJO: como es una funcion, en un componente se usa asi:
      //   const logged = useAuthStore((s) => s.isAuthenticated())
      isAuthenticated: () => Boolean(get().token && get().user),

      clearError: () => set({ error: '' }),
    }),
    {
      // Nombre de la llave en localStorage (se ve en DevTools -> Application -> Local Storage)
      name: 'syncpos-auth',

      // partialize: elige QUE parte del estado se guarda. Solo user y token.
      // - NUNCA se guarda la contrasena (ni siquiera existe en el store).
      // - loading y error son temporales: al recargar deben empezar limpios.
      // - Las acciones (funciones) no se guardan en JSON.
      // ADVERTENCIA (la guia lo senala): un token en localStorage puede ser leido por
      // cualquier script de la pagina (ataque XSS). En produccion se prefiere una cookie
      // httpOnly que JavaScript no puede leer. Para este proyecto de aprendizaje se acepta.
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
)
