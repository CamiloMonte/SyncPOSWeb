// Único archivo que usa fetch: el resto de la app llama a "api.get", "api.post", etc.
// Así, si cambia la dirección o la forma de autenticar, solo se modifica aquí.

import { useAuthStore } from '../store/useAuthStore'

// Vite lee la variable desde el archivo .env (debe empezar por VITE_)
const API_URL = import.meta.env.VITE_API_URL

// ---- Sesion ----
// MIGRACION (antes -> ahora):
//   ANTES: este archivo tenia saveSession/getSession/clearSession (localStorage a mano) y
//          avisaba a App.jsx con un evento de window ('syncpos:logout').
//   AHORA: la sesion vive en useAuthStore (Zustand + persist). Aqui solo la LEEMOS.
//
// HOOK/STORE: api.js NO es un componente, asi que no puede usar el hook useAuthStore().
// Para leer el store fuera de React existe getState(): devuelve el estado actual en ese
// instante. No suscribe a nada (no hay re-dibujos), solo lee. Se usa dentro de request(),
// porque asi se lee el token mas reciente en cada peticion.
// (useAuthStore importa a api y api importa a useAuthStore: no es un problema porque cada
// uno solo usa al otro dentro de funciones, nunca mientras se carga el archivo.)

// ---- Errores ----
// Error propio con datos extra: el código HTTP y los errores de validación de Laravel.
export class ApiError extends Error {
  constructor(message, status, errors = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

// ---- Petición genérica ----
// async/await: "await" pausa la función hasta que llegue la respuesta, sin congelar la página.
async function request(method, path, body) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  // Si hay sesión, enviamos el token para que Laravel sepa quién hace la petición
  // getState() lee el token actual del store (ver nota de arriba)
  const token = useAuthStore.getState().token
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    // fetch solo falla (sin respuesta) cuando no hay conexión con el servidor
    throw new Error('No se pudo conectar con el servidor. Verifica que Laravel esté encendido.')
  }

  // Las respuestas 204 no traen cuerpo; en ese caso no hay nada que convertir a JSON
  let data = null
  if (response.status !== 204) {
    data = await response.json().catch(() => null)
  }

  // 401 = token faltante, vencido o invalido: se borra la sesion del store.
  // Se usa logoutLocal() y NO logout(): logout() llamaria a POST /logout con un token
  // invalido, recibiria otro 401 y entraria en un ciclo infinito.
  // Ya no hace falta avisar a App.jsx con un evento: ProtectedRoute lee el token del store,
  // y al quedar en null la interfaz redirige sola a /login.
  if (response.status === 401) {
    useAuthStore.getState().logoutLocal()
    throw new ApiError(data?.message || 'Tu sesión expiró. Inicia sesión de nuevo.', 401)
  }

  if (!response.ok) {
    throw new ApiError(data?.message || 'Ocurrió un error inesperado.', response.status, data?.errors ?? null)
  }

  return data
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
}

// ---- Estado del servidor ----
// Consulta GET /estado (ruta publica). No usa request(): no envia el token y un 401 aqui
// no debe cerrar la sesion. Devuelve 'online', 'db-down' u 'offline'.
export async function checkServerStatus() {
  // AbortController cancela la peticion si el servidor tarda mas de 5 segundos.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(`${API_URL}/estado`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (response.status === 503) return 'db-down'

    const data = await response.json().catch(() => null)
    return response.ok && data?.estado === 'ok' ? 'online' : 'offline'
  } catch {
    // Sin red, servidor apagado o tiempo agotado
    return 'offline'
  } finally {
    clearTimeout(timer)
  }
}
