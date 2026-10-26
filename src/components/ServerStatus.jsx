import { useEffect, useState } from 'react'
import StatusPill from './StatusPill'
import { checkServerStatus } from '../services/api'

// Cada estado del servidor: que estilo de pill usar y que texto mostrar.
const statuses = {
  checking: { pill: 'neutral', label: 'Verificando servidor…' },
  online: { pill: 'online', label: 'Servidor Conectado (MySQL)' },
  'db-down': { pill: 'danger', label: 'Base de datos sin conexión' },
  offline: { pill: 'danger', label: 'Sin conexión con el servidor' },
}

// Pill que muestra el estado REAL del servidor. Se usa en el Header y en el Login.
export default function ServerStatus() {
  // HOOK: useState guarda el estado actual; empieza en 'checking' hasta tener respuesta.
  const [status, setStatus] = useState('checking')

  // HOOK: useEffect corre despues de dibujar. Con [] se ejecuta solo al montar el componente.
  useEffect(() => {
    // "ignore" evita actualizar el estado si el componente ya se desmonto.
    let ignore = false

    async function check() {
      const result = await checkServerStatus()
      if (!ignore) setStatus(result)
    }

    check()

    // Repite la consulta cada 30 segundos.
    const interval = setInterval(check, 30000)

    // Si el navegador detecta que volvio o se perdio la red, consultamos de inmediato.
    window.addEventListener('online', check)
    window.addEventListener('offline', check)

    // Funcion de limpieza: React la ejecuta al desmontar. Quita el intervalo y los listeners.
    return () => {
      ignore = true
      clearInterval(interval)
      window.removeEventListener('online', check)
      window.removeEventListener('offline', check)
    }
  }, [])

  const { pill, label } = statuses[status]
  return <StatusPill status={pill}>{label}</StatusPill>
}
