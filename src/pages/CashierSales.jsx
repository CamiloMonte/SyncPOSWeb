import { useEffect, useState } from 'react'
import { DollarSign, Banknote, Smartphone, WifiOff, Lock } from 'lucide-react'
import Button from '../components/Button'
import KpiCard from '../components/KpiCard'
import StatusPill from '../components/StatusPill'
import { api } from '../services/api'
import { formatDateShort, toLocalDateString } from '../utils/dates'
import { formatCOP, formatMethod, formatTime } from '../utils/format'

// Base de caja con la que normalmente empieza el turno
const DEFAULT_BASE = 200000

// Porcentaje que representa "part" dentro de "total" (0 si todavia no hay ventas)
function share(part, total) {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : '0%'
}

export default function CashierSales() {
  // ---------------------------------------------------------------
  // ESTADO (useState)
  // ---------------------------------------------------------------

  // HOOK: useState guarda un dato; al cambiarlo, React vuelve a dibujar la pagina.
  const [summary, setSummary] = useState(null) // respuesta de /mis-ventas/resumen
  const [sales, setSales] = useState([]) // ventas de la pagina actual
  const [meta, setMeta] = useState(null) // datos de paginacion
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0) // cambiarlo vuelve a pedir los datos ("Reintentar")

  // Datos del cierre de caja. Se guardan como texto porque asi los entrega un <input>.
  const [base, setBase] = useState(String(DEFAULT_BASE))
  // null significa "el cajero todavia no escribio nada": en ese caso se usa el valor esperado
  const [counted, setCounted] = useState(null)

  // Fecha de hoy para el encabezado (dd/mm/aaaa). Se calcula una sola vez al crear el componente.
  const [todayText] = useState(() => formatDateShort(toLocalDateString(new Date())))

  // ---------------------------------------------------------------
  // EFECTOS (useEffect)
  // ---------------------------------------------------------------

  // HOOK: useEffect pide los datos al entrar y cada vez que cambia la pagina o "reloadKey".
  useEffect(() => {
    // "ignore" descarta respuestas viejas (por ejemplo si el cajero pulsa "Siguiente" muy rapido)
    let ignore = false

    async function loadData() {
      setLoading(true)
      setError('')

      try {
        // Fecha de hoy en hora local (ver utils/dates.js para saber por que NO usamos toISOString)
        const today = toLocalDateString(new Date())
        const params = new URLSearchParams({ desde: today, hasta: today, page })

        // Promise.all lanza las dos peticiones AL MISMO TIEMPO y espera a que terminen ambas.
        // Es mas rapido que hacer un await y luego otro, porque no dependen una de la otra.
        // Si cualquiera falla, Promise.all lanza el error y cae en el catch.
        const [summaryResponse, salesResponse] = await Promise.all([
          api.get(`/mis-ventas/resumen?fecha=${today}`),
          api.get(`/ventas?${params}`),
        ])

        if (ignore) return
        setSummary(summaryResponse)
        setSales(salesResponse.data)
        setMeta(salesResponse.meta)
      } catch (err) {
        if (!ignore) setError(err.message)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadData()

    return () => {
      ignore = true
    }
  }, [page, reloadKey])

  // Pide de nuevo los datos (boton "Reintentar")
  function reload() {
    setReloadKey((key) => key + 1)
  }

  // ---------------------------------------------------------------
  // VALORES CALCULADOS
  // No son estado: se calculan en cada dibujo a partir del estado y de la respuesta de la API.
  // ---------------------------------------------------------------

  // NOTA: el backend NO tiene un endpoint para cerrar caja. Por eso el cierre se calcula aqui,
  // en pantalla, con los totales de /mis-ventas/resumen y lo que escribe el cajero.
  const cashTotal = summary?.efectivo.total ?? 0
  const nequiTotal = summary?.nequi.total ?? 0
  const dayTotal = summary?.total ?? 0

  const baseAmount = Number(base) || 0 // si el campo esta vacio, Number('') da 0
  const expected = baseAmount + cashTotal // lo que deberia haber en la caja
  const countedAmount = counted === null ? expected : Number(counted) || 0 // por defecto, lo esperado
  const difference = countedAmount - expected
  // Signo explicito: +$ 5.000 / -$ 5.000 (formatCOP ya pone el "-" en los negativos)
  const differenceText = (difference > 0 ? '+' : '') + formatCOP(difference)

  // Cierra la caja: muestra un resumen para confirmar y luego abre la impresion del navegador.
  // Guardar el cierre en la base de datos requeriria un endpoint nuevo en Laravel
  // (por ejemplo POST /cierres-caja). Ese es el siguiente paso del proyecto.
  function closeCashRegister() {
    const summaryText =
      `Base inicial: ${formatCOP(baseAmount)}\n` +
      `Ventas en efectivo: ${formatCOP(cashTotal)}\n` +
      `Esperado en caja: ${formatCOP(expected)}\n` +
      `Efectivo contado: ${formatCOP(countedAmount)}\n` +
      `Diferencia: ${differenceText}\n` +
      `Ventas Nequi: ${formatCOP(nequiTotal)}\n` +
      `Total del turno: ${formatCOP(dayTotal)}\n\n` +
      '¿Deseas cerrar la caja e imprimir el resumen?'

    // window.confirm abre un cuadro con "Aceptar / Cancelar" y devuelve true o false
    if (window.confirm(summaryText)) {
      window.print()
    }
  }

  return (
    <div className="space-y-6">
      {/* Caja roja de error con boton para reintentar */}
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-danger bg-danger-bg px-4 py-3 text-sm text-danger-text">
          <span>{error}</span>
          <Button variant="danger" onClick={reload}>Reintentar</Button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-6">
        <KpiCard
          title="Mis Ventas de Hoy"
          value={formatCOP(dayTotal)}
          detail={`${summary?.cantidad ?? 0} ventas`}
          icon={DollarSign}
          tone="success"
        />
        <KpiCard
          title="Efectivo"
          value={formatCOP(cashTotal)}
          trend={share(cashTotal, dayTotal)}
          detail={`${summary?.efectivo.cantidad ?? 0} ventas`}
          icon={Banknote}
          tone="success"
        />
        <KpiCard
          title="Nequi"
          value={formatCOP(nequiTotal)}
          trend={share(nequiTotal, dayTotal)}
          detail={`${summary?.nequi.cantidad ?? 0} ventas`}
          icon={Smartphone}
          tone="info"
        />
        <KpiCard
          title="Ventas Offline"
          value={summary?.offline.cantidad ?? 0}
          detail="Sincronizadas desde el celular"
          icon={WifiOff}
          tone="warning"
        />
      </div>

      <div className="flex gap-6">
        <div className="min-w-0 flex-1 self-start overflow-hidden rounded-xl border border-border bg-surface">
          <h2 className="p-6 text-lg font-semibold">Mis ventas</h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-background text-xs text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">N° VENTA</th>
                <th className="px-4 py-3 font-medium">HORA</th>
                <th className="px-4 py-3 font-medium">MEDIO DE PAGO</th>
                <th className="px-4 py-3 font-medium">TIPO</th>
                <th className="px-4 py-3 text-right font-medium">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {/* Renderizado condicional: cargando, vacio o la lista */}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">Cargando ventas...</td>
                </tr>
              )}
              {!loading && !error && sales.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                    Todavía no registras ventas hoy.
                  </td>
                </tr>
              )}
              {!loading &&
                sales.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{s.numero}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatTime(s.vendida_en)}</td>
                    <td className="px-4 py-3">{formatMethod(s.metodo_pago)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={s.origen === 'offline' ? 'offline' : 'online'}>
                        {s.origen === 'offline' ? 'Sincronizada Offline' : 'Online'}
                      </StatusPill>
                    </td>
                    {/* Laravel envia el dinero como texto ("48500.00"): Number() lo convierte */}
                    <td className="px-4 py-3 text-right font-semibold">{formatCOP(Number(s.total))}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          {/* Paginacion: solo aparece si hay mas de una pagina de ventas */}
          {meta && meta.last_page > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-text-secondary">
              <p>
                Mostrando {meta.from ?? 0}–{meta.to ?? 0} de {meta.total} ventas
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  disabled={loading || meta.current_page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  disabled={loading || meta.current_page >= meta.last_page}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Cierre de caja */}
        <div className="w-[360px] shrink-0 self-start rounded-xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Cierre de Caja</h2>
          <p className="text-xs text-text-secondary">Turno de hoy · {todayText}</p>

          {/* Input controlado: su valor viene del estado y cada tecla lo actualiza */}
          <label className="mt-5 block text-sm font-medium">
            Base inicial
            <input
              type="number"
              min="0"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-sena"
            />
          </label>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-text-secondary">Ventas en efectivo</span><span>{formatCOP(cashTotal)}</span></div>
            <div className="flex justify-between font-bold"><span>Esperado en caja</span><span>{formatCOP(expected)}</span></div>
            <hr className="border-border" />
            <div className="flex justify-between"><span className="text-text-secondary">Ventas Nequi</span><span>{formatCOP(nequiTotal)}</span></div>
            <div className="flex justify-between font-bold text-sena"><span>Total del turno</span><span>{formatCOP(dayTotal)}</span></div>
            <hr className="border-border" />
          </div>

          <label className="mt-4 block text-sm font-medium">
            Efectivo contado
            {/* Mientras el cajero no escriba, se muestra el valor esperado (counted === null) */}
            <input
              type="number"
              min="0"
              value={counted === null ? expected : counted}
              onChange={(e) => setCounted(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-sena"
            />
          </label>
          <div className="mt-3 flex justify-between text-sm font-semibold">
            <span>Diferencia</span>
            <span className={difference === 0 ? 'text-sena' : 'text-danger'}>{differenceText}</span>
          </div>

          <div className="mt-5 space-y-3">
            <Button icon={Lock} className="w-full" onClick={closeCashRegister} disabled={!summary}>Cerrar Caja</Button>
            {/* window.print() abre el cuadro de impresion del navegador */}
            <Button variant="secondary" className="w-full" onClick={() => window.print()}>
              Imprimir resumen del turno
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
