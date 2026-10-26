// Único archivo que usa fetch: el resto de la app llama a "api.get", "api.post", etc.
// Así, si cambia la dirección o la forma de autenticar, solo se modifica aquí.

// Vite lee la variable desde el archivo .env (debe empezar por VITE_)
const API_URL = import.meta.env.VITE_API_URL

const TOKEN_KEY = 'syncpos_token'
const USER_KEY = 'syncpos_user'

// ---- Sesión ----
// localStorage guarda texto en el navegador y no se borra al recargar la página.
// Por eso solo admite strings: el usuario (objeto) se convierte con JSON.stringify.

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getSession() {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const user = JSON.parse(localStorage.getItem(USER_KEY))
    // Si falta alguno de los dos, no hay sesión válida
    return token && user ? { token, user } : null
  } catch {
    // JSON.parse falla si el texto guardado está dañado
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

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
  const session = getSession()
  if (session) headers.Authorization = `Bearer ${session.token}`

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

  // 401 = token faltante, vencido o inválido: se cierra la sesión y se avisa a la app
  if (response.status === 401) {
    clearSession()
    window.dispatchEvent(new Event('syncpos:logout'))
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
