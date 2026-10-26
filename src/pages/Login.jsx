import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WifiOff, Package, TrendingUp, Mail, Lock } from 'lucide-react'
import ServerStatus from '../components/ServerStatus'
import Button from '../components/Button'
import { useAuthStore } from '../store/useAuthStore'
import { homeFor } from '../utils/homeFor'

// Características que se muestran en el panel izquierdo
const features = [
  { icon: WifiOff, title: 'Ventas offline', text: 'Registra ventas sin conexión y sincronízalas después.' },
  { icon: Package, title: 'Inventario en tiempo real', text: 'El stock se actualiza con cada venta realizada.' },
  { icon: TrendingUp, title: 'Rentabilidad clara', text: 'Conoce tu ganancia por producto y por período.' },
]

export default function Login() {
  // Formulario controlado: cada campo tiene su propio estado LOCAL.
  // Zustand no reemplaza a useState: lo que escribe el usuario en un input solo le importa
  // a este componente. La contrasena nunca debe ir a un store (y menos a uno con persist).
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Error de validacion del formulario (campos vacios). El error de la API vive en el store.
  const [formError, setFormError] = useState('')

  // HOOK: useAuthStore con selectores. Un selector por cada dato o accion que necesitamos,
  // asi Login solo se redibuja cuando ESE dato cambia.
  const login = useAuthStore((state) => state.login)
  const loading = useAuthStore((state) => state.loading)
  const apiError = useAuthStore((state) => state.error)
  const clearError = useAuthStore((state) => state.clearError)

  // HOOK: useNavigate devuelve una funcion para cambiar de URL desde el codigo
  const navigate = useNavigate()

  // HOOK: useEffect con [] se ejecuta una sola vez, al mostrar el login.
  // Cambia el titulo de la pestana del navegador (las demas paginas lo hacen en App.jsx).
  useEffect(() => {
    document.title = 'Iniciar sesión · SyncPOS'
  }, [])

  // async permite usar "await": esperar la respuesta de la API sin bloquear la página
  async function handleSubmit(event) {
    event.preventDefault() // evita que el navegador recargue la página

    // Validación sencilla: ambos campos son obligatorios
    if (email.trim() === '' || password.trim() === '') {
      setFormError('Ingresa tu correo y tu contraseña.')
      return
    }

    setFormError('')
    clearError()

    // La accion login() del store hace el POST /login, guarda user + token y maneja
    // loading/error. Devuelve true si salio bien.
    const ok = await login(email, password)
    if (ok) {
      // getState() lee el usuario recien guardado sin esperar a que React redibuje.
      // replace: true -> /login se reemplaza en el historial, asi "atras" no regresa al formulario
      navigate(homeFor(useAuthStore.getState().user), { replace: true })
    }
  }

  // Mostramos primero el error del formulario y, si no hay, el que dejo la API en el store
  const error = formError || apiError

  return (
    <div className="flex h-screen">
      {/* Panel de marca (izquierda) */}
      <div className="flex w-[640px] shrink-0 flex-col justify-between bg-dark p-12 max-lg:hidden">
        {/* Logo completo (icono + nombre). Ya trae el texto "SyncPOS", por eso no se repite */}
        <img src="/syncpos-logo.png" alt="SyncPOS" className="h-20 w-auto self-start rounded-xl" />

        <div>
          <h1 className="text-4xl leading-tight font-bold text-white">
            Controla tu inventario y vende incluso sin internet.
          </h1>
          <p className="mt-4 text-base text-muted">
            Un sistema de punto de venta pensado para tiendas que no pueden detenerse.
          </p>
          <div className="mt-10 space-y-6">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-dark-2 text-sena">
                  <feature.icon size={20} />
                </span>
                <div>
                  <p className="font-semibold text-white">{feature.title}</p>
                  <p className="text-sm text-muted">{feature.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted">Proyecto SENA · SyncPOS v1.0 · 2026</p>
      </div>

      {/* Formulario (derecha) */}
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-[440px] rounded-xl border border-border bg-surface p-8"
        >
          <h2 className="text-2xl font-bold text-dark">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Ingresa con tu cuenta de administrador o cajero.
          </p>

          {/* Ya no hay selector de rol: el usuario no puede elegir su rol.
              Lo define el servidor según la cuenta (campo "rol"), así nadie puede
              hacerse pasar por administrador desde el navegador. */}

          <label className="mt-6 block text-sm font-medium text-dark">
            Correo electrónico
            <div className="relative mt-1.5">
              <Mail size={16} className="absolute top-3.5 left-3 text-text-secondary" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="h-11 w-full rounded-lg border border-border pr-3 pl-9 font-normal outline-none focus:border-sena"
              />
            </div>
          </label>

          <label className="mt-4 block text-sm font-medium text-dark">
            Contraseña
            <div className="relative mt-1.5">
              <Lock size={16} className="absolute top-3.5 left-3 text-text-secondary" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-lg border border-border pr-3 pl-9 font-normal outline-none focus:border-sena"
              />
            </div>
          </label>

          <div className="mt-4 flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-text-secondary">
              <input type="checkbox" className="accent-sena" />
              Recordarme
            </label>
            <a href="#" className="font-medium text-sena">¿Olvidaste tu contraseña?</a>
          </div>

          {/* Mensaje de error: solo aparece si "error" tiene texto */}
          {error && (
            <p className="mt-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-text">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="mt-6 h-12 w-full">
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </Button>

          {/* Solo para pruebas: quitar antes de producción */}
          <p className="mt-4 text-center text-[12px] text-text-secondary">
            Usuarios de prueba: admin@syncpos.co / cajero@syncpos.co · contraseña: password
          </p>

          <div className="mt-6 flex justify-center">
            <ServerStatus />
          </div>
        </form>
      </div>
    </div>
  )
}
