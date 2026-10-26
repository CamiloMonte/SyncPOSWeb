import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Package, AlertTriangle, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../components/Button'
import KpiCard from '../components/KpiCard'
import StatusPill from '../components/StatusPill'
import { api } from '../services/api'
import { parseLocalDate, toLocalDateString } from '../utils/dates'
import { formatCOP, formatMethod, formatPercent, formatTime } from '../utils/format'

// Devuelve la etiqueta del eje X de la grafica: "Hoy" para el ultimo dia y el dia de la
// semana abreviado ("mie", "jue"...) para los demas.
function dayLabel(fecha, isLast) {
  if (isLast) return 'Hoy'
  // parseLocalDate crea la fecha con hora LOCAL. Si usaramos new Date("2026-10-15")
  // JavaScript la leeria como UTC y en Colombia (UTC-5) el dia saldria desplazado: el 14.
  const text = parseLocalDate(fecha).toLocaleDateString('es-CO', { weekday: 'short' })
  // Quitamos el punto final si lo trae ("mie." -> "mie") y ponemos la primera letra en mayuscula
  const clean = text.replace('.', '')
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

export default function Dashboard() {
  // ---------------------------------------------------------------
  // ESTADO (useState)
  // ---------------------------------------------------------------

  // HOOK: useState guarda un dato; al cambiarlo con su "set", React vuelve a dibujar la pagina.
  const [summary, setSummary] = useState(null) // respuesta de /reportes/resumen-dia (null = aun no llega)
  const [loading, setLoading] = useState(true) // true mientras esperamos la respuesta
  const [error, setError] = useState('') // mensaje si la peticion falla ('' = sin error)

  // Cambiar este numero vuelve a ejecutar el efecto: sirve para "Reintentar" y "Actualizar"
  const [reloadKey, setReloadKey] = useState(0)

  // ---------------------------------------------------------------
  // EFECTOS (useEffect)
  // ---------------------------------------------------------------

  // HOOK: useEffect ejecuta codigo despues de dibujar la pagina. Aqui pide el resumen a la API
  // al entrar y cada vez que cambia "reloadKey".
  useEffect(() => {
    // "ignore" descarta respuestas viejas: si el efecto se repite o la pagina se cierra antes
    // de que llegue la respuesta, esa respuesta tardia no debe modificar el estado.
    let ignore = false

    async function loadSummary() {
      setLoading(true)
      setError('')

      try {
        // Fecha de hoy en hora local (ver utils/dates.js para saber por que NO usamos toISOString)
        const today = toLocalDateString(new Date())
        const response = await api.get(`/reportes/resumen-dia?fecha=${today}`)
        if (!ignore) setSummary(response)
      } catch (err) {
        if (!ignore) setError(err.message)
      } finally {
        // finally se ejecuta siempre, haya salido bien o mal: aqui apagamos el "cargando"
        if (!ignore) setLoading(false)
      }
    }

    loadSummary()

    // Cleanup: React lo ejecuta antes de repetir el efecto o al salir de la pagina
    return () => {
      ignore = true
    }
  }, [reloadKey])

  // Pide de nuevo los datos (botones "Actualizar" y "Reintentar")
  function reload() {
    setReloadKey((key) => key + 1)
  }

  // ---------------------------------------------------------------
  // VALORES CALCULADOS
  // No necesitan useState: se recalculan en cada dibujo a partir de "summary".
  // ---------------------------------------------------------------

  const days = summary?.ultimos_7_dias ?? []
  const lastSales = summary?.ultimas_ventas ?? []

  // Valor maximo de ventas de los 7 dias: la barra mas alta mide 100% y las demas se escalan
  // contra ella. El 0 al final evita que Math.max() sin elementos devuelva -Infinity.
  const maxSales = Math.max(0, ...days.map((d) => d.ventas))

  // Margen = ganancia / ventas * 100. Solo se calcula si hubo ventas (no se puede dividir por 0).
  const margin = summary && summary.ventas_total > 0 ? (summary.ganancia_neta / summary.ventas_total) * 100 : null

  return (
    <div className="space-y-6">
      {/* Boton para volver a pedir los datos sin recargar toda la pagina */}
      <div className="flex justify-end">
        <Button variant="secondary" icon={RefreshCw} onClick={reload} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar'}
        </Button>
      </div>

      {/* Caja roja de error con boton para reintentar */}
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-danger bg-danger-bg px-4 py-3 text-sm text-danger-text">
          <span>{error}</span>
          <Button variant="danger" onClick={reload}>Reintentar</Button>
        </div>
      )}

      {/* Estado de carga inicial: todavia no hay datos que mostrar */}
      {!summary && loading && (
        <p className="rounded-xl border border-border bg-surface p-8 text-center text-text-secondary">
          Cargando resumen del día...
        </p>
      )}

      {/* Renderizado condicional: el contenido solo se dibuja cuando ya llegaron los datos */}
      {summary && !error && (
        <>
          {/* Fila de indicadores */}
          <div className="grid grid-cols-4 gap-6">
            <KpiCard
              title="Ventas de Hoy"
              value={formatCOP(summary.ventas_total)}
              detail={`${summary.pedidos} ${summary.pedidos === 1 ? 'pedido' : 'pedidos'}`}
              icon={DollarSign}
              tone="success"
            />
            <KpiCard
              title="Ganancia Neta"
              value={formatCOP(summary.ganancia_neta)}
              trend={margin === null ? undefined : `Margen ${formatPercent(margin)}`}
              detail="Ventas − Costo de mercancía"
              icon={TrendingUp}
              tone="success"
            />
            <KpiCard
              title="Inversión en Inventario"
              value={formatCOP(summary.inversion_inventario)}
              detail="Costo del stock disponible"
              icon={Package}
              tone="info"
            />
            {/* Link envuelve la tarjeta completa: al hacer clic va a /inventario sin recargar */}
            <Link to="/inventario" className="block transition-shadow hover:shadow-md">
              <KpiCard
                title="Alertas de Stock"
                value={summary.alertas_stock}
                trend={summary.alertas_stock > 0 ? 'Crítico' : undefined}
                detail="productos bajo el mínimo"
                icon={AlertTriangle}
                tone="danger"
              />
            </Link>
          </div>

          <div className="flex gap-6">
            {/* Grafica de barras hecha solo con CSS */}
            <div className="min-w-0 flex-1 rounded-xl border border-border bg-surface p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-dark">Ventas vs. Ganancias</h2>
                  <p className="text-xs text-text-secondary">Últimos 7 días · valores en COP</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-text-secondary">
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-sena" />Ventas</span>
                  <span className="flex items-center gap-1.5"><span className="h-1 w-3 rounded-sm bg-dark" />Ganancias</span>
                </div>
              </div>

              {/* Estado vacio: si todos los dias valen 0 no hay nada que graficar */}
              {maxSales === 0 ? (
                <p className="mt-6 flex h-64 items-center justify-center text-sm text-text-secondary">
                  Aún no hay ventas en los últimos 7 días.
                </p>
              ) : (
                <div className="mt-6 flex h-64 items-end gap-4">
                  {/* map(): una columna por cada dia */}
                  {days.map((d, index) => (
                    <div key={d.fecha} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <div className="flex h-full w-full items-end justify-center gap-1">
                        {/* Escala de la barra: valor / maximo * 100 = porcentaje de la altura disponible.
                            Math.max(0, ...) evita alturas negativas si hubiera una ganancia negativa. */}
                        <div
                          className="w-7 rounded-t-md bg-sena"
                          style={{ height: `${(Math.max(0, d.ventas) / maxSales) * 100}%` }}
                          title={`Ventas: ${formatCOP(d.ventas)}`}
                        />
                        <div
                          className="w-3 rounded-t-md bg-dark"
                          style={{ height: `${(Math.max(0, d.ganancia) / maxSales) * 100}%` }}
                          title={`Ganancia: ${formatCOP(d.ganancia)}`}
                        />
                      </div>
                      <span className="text-xs font-medium text-text-secondary">
                        {dayLabel(d.fecha, index === days.length - 1)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tabla de ultimas ventas */}
            <div className="w-[460px] shrink-0 rounded-xl border border-border bg-surface p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-dark">Últimas ventas</h2>
                  <p className="text-xs text-text-secondary">5 registros más recientes</p>
                </div>
                {/* Link cambia la URL a /historial sin recargar la pagina */}
                <Link to="/historial" className="text-sm font-medium text-sena">
                  Ver todas →
                </Link>
              </div>

              <table className="mt-4 w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-text-secondary">
                    <th className="py-2 font-medium">N° VENTA</th>
                    <th className="py-2 font-medium">HORA</th>
                    <th className="py-2 font-medium">MÉTODO</th>
                    <th className="py-2 text-right font-medium">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Estado vacio de la tabla */}
                  {lastSales.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-text-secondary">
                        Todavía no hay ventas registradas.
                      </td>
                    </tr>
                  )}
                  {lastSales.map((sale) => (
                    // key: el id que viene de la base de datos es unico y estable
                    <tr key={sale.id} className="border-t border-border">
                      <td className="py-3 font-medium">{sale.numero}</td>
                      <td className="py-3 text-text-secondary">{formatTime(sale.vendida_en)}</td>
                      <td className="py-3">
                        <StatusPill status={sale.metodo_pago === 'nequi' ? 'pending' : 'success'}>
                          {formatMethod(sale.metodo_pago)}
                        </StatusPill>
                      </td>
                      {/* Laravel envia el dinero como texto ("48500.00"): Number() lo convierte */}
                      <td className="py-3 text-right font-semibold">{formatCOP(Number(sale.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
