import { useEffect, useState } from 'react'
import { DollarSign, Package, TrendingUp, Download, FileSpreadsheet } from 'lucide-react'
import Button from '../components/Button'
import KpiCard from '../components/KpiCard'
import { api } from '../services/api'
import { formatDateShort, rangeFor } from '../utils/dates'
import { formatCOP, formatPercent } from '../utils/format'

const ranges = ['Día', 'Semana', 'Mes', 'Personalizado']

// Convierte un valor en una celda valida de CSV.
// Si el texto tiene coma, comillas o salto de linea, se encierra entre comillas y las comillas
// internas se duplican (regla del formato CSV). Ejemplo: Cafe "Premium", 500g -> "Cafe ""Premium"", 500g"
function csvCell(value) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export default function Reports() {
  // ---------------------------------------------------------------
  // ESTADO (useState)
  // ---------------------------------------------------------------

  // HOOK: useState guarda un dato; al cambiarlo, React vuelve a dibujar la pagina.
  const [option, setOption] = useState('Mes') // boton de rango elegido

  // Fechas del rango "Personalizado". El valor inicial es el mes actual.
  // Pasar una funcion a useState la ejecuta UNA sola vez (al crear el componente).
  const [customFrom, setCustomFrom] = useState(() => rangeFor('Mes', new Date()).desde)
  const [customTo, setCustomTo] = useState(() => rangeFor('Mes', new Date()).hasta)

  const [report, setReport] = useState(null) // respuesta de /reportes/rentabilidad
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0) // cambiarlo vuelve a pedir el reporte ("Reintentar")

  // Fecha de hoy: se calcula una sola vez (inicializador perezoso) para que el render sea estable
  const [today] = useState(() => new Date())

  // ---------------------------------------------------------------
  // VALORES CALCULADOS (no necesitan useState, se derivan de otros datos en cada dibujo)
  // ---------------------------------------------------------------

  // Rango que se envia a la API: el personalizado viene de los inputs; los demas se calculan.
  const { desde, hasta } =
    option === 'Personalizado' ? { desde: customFrom, hasta: customTo } : rangeFor(option, today)

  // Las fechas son texto "YYYY-MM-DD", y comparar ese texto equivale a comparar fechas.
  const customInvalid = option === 'Personalizado' && (!desde || !hasta || desde > hasta)

  // ---------------------------------------------------------------
  // EFECTOS (useEffect)
  // ---------------------------------------------------------------

  // HOOK: useEffect pide el reporte cuando cambian las fechas o "reloadKey".
  // desde y hasta son texto, por eso React los compara por valor y el efecto no se repite de mas.
  useEffect(() => {
    // Rango personalizado incompleto o al reves: no se pide nada (se muestra un aviso)
    if (customInvalid) return

    // "ignore" descarta respuestas viejas si el usuario cambia de rango antes de que llegue la anterior
    let ignore = false

    async function loadReport() {
      setLoading(true)
      setError('')

      try {
        const params = new URLSearchParams({ desde, hasta })
        const response = await api.get(`/reportes/rentabilidad?${params}`)
        if (!ignore) setReport(response)
      } catch (err) {
        if (!ignore) setError(err.message)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadReport()

    return () => {
      ignore = true
    }
  }, [desde, hasta, customInvalid, reloadKey])

  // Pide de nuevo el reporte (boton "Reintentar")
  function reload() {
    setReloadKey((key) => key + 1)
  }

  // Los numeros de la API llegan como numeros JSON; Number() solo protege por si llegara texto
  const rows = report?.productos ?? []
  const totals = report?.totales
  // reduce() recorre la lista acumulando un valor: aqui, la suma de unidades
  const totalUnits = rows.reduce((sum, r) => sum + Number(r.unidades), 0)
  // Porcentaje del costo sobre los ingresos (solo si hubo ingresos, para no dividir por 0)
  const costShare = totals && Number(totals.ingresos) > 0 ? (Number(totals.costo) / Number(totals.ingresos)) * 100 : 0

  // ---------------------------------------------------------------
  // EXPORTAR
  // ---------------------------------------------------------------

  // Descarga un CSV armado con los datos que ya trajo la API.
  function downloadCsv() {
    if (!report) return

    // 1) Primera linea: los encabezados de las columnas
    const lines = ['Producto,Unidades,Ingresos,Costo,Ganancia,Margen %,Contribución %']

    // 2) Una linea por producto. Los numeros van SIN separador de miles (Excel los lee como numeros)
    rows.forEach((r) => {
      lines.push(
        [csvCell(r.nombre), r.unidades, r.ingresos, r.costo, r.ganancia, r.margen, r.contribucion].join(','),
      )
    })

    // 3) Blob = "archivo en memoria". Se antepone el BOM (caracter U+FEFF), una marca invisible que le
    //    avisa a Excel que el archivo es UTF-8; sin ella las tildes se ven mal (texto danado).
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })

    // 4) createObjectURL crea una direccion temporal que apunta al Blob. Se crea un enlace <a>
    //    invisible con el atributo "download", se le hace clic por codigo y se libera la direccion.
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rentabilidad_${report.periodo.desde}_${report.periodo.hasta}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // No hay libreria de PDF: el dialogo de impresion del navegador permite elegir
  // "Guardar como PDF" como destino.
  function exportPdf() {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setOption(r)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                option === r ? 'bg-sena text-white' : 'text-text-secondary'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {/* Los campos de fecha solo aparecen en el rango "Personalizado" (inputs controlados) */}
        {option === 'Personalizado' && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-10 rounded-lg border border-border bg-surface px-3"
            />
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-10 rounded-lg border border-border bg-surface px-3"
            />
          </>
        )}
        {/* El periodo mostrado es el que respondio la API (report.periodo) */}
        {report && !customInvalid && (
          <span className="text-sm text-text-secondary">
            Período: {formatDateShort(report.periodo.desde)} – {formatDateShort(report.periodo.hasta)}
          </span>
        )}
        {customInvalid && (
          <span className="text-sm text-danger">Elige dos fechas válidas: la inicial no puede ser mayor que la final.</span>
        )}
        <div className="flex-1" />
        <Button variant="secondary" icon={Download} onClick={exportPdf} disabled={!report || customInvalid}>
          Exportar PDF
        </Button>
        <Button variant="secondary" icon={FileSpreadsheet} onClick={downloadCsv} disabled={!report || customInvalid}>
          Exportar Excel (CSV)
        </Button>
      </div>

      {/* Caja roja de error con boton para reintentar */}
      {error && !customInvalid && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-danger bg-danger-bg px-4 py-3 text-sm text-danger-text">
          <span>{error}</span>
          <Button variant="danger" onClick={reload}>Reintentar</Button>
        </div>
      )}

      {/* Estado de carga */}
      {loading && !customInvalid && (
        <p className="rounded-xl border border-border bg-surface p-8 text-center text-text-secondary">
          Cargando reporte...
        </p>
      )}

      {/* El contenido solo se dibuja si hay datos, no esta cargando, no hay error y el rango es valido */}
      {report && !loading && !error && !customInvalid && (
        <>
          <div className="grid grid-cols-3 gap-6">
            <KpiCard
              title="Total Ingresos por Ventas"
              value={formatCOP(Number(totals.ingresos))}
              detail={`${totalUnits} unidades vendidas`}
              icon={DollarSign}
              tone="success"
            />
            <KpiCard
              title="Costo de Mercancía Vendida"
              value={formatCOP(Number(totals.costo))}
              detail={`${formatPercent(costShare)} de los ingresos`}
              icon={Package}
              tone="warning"
            />
            <KpiCard
              title="Ganancia Neta Total"
              value={formatCOP(Number(totals.ganancia))}
              trend={`Margen ${formatPercent(Number(totals.margen))}`}
              detail="Ingresos − Costo"
              icon={TrendingUp}
              tone="success"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <h2 className="p-6 text-lg font-semibold">Desglose de Rentabilidad por Producto</h2>
            <table className="w-full text-left text-sm">
              <thead className="bg-background text-xs text-text-secondary">
                <tr>
                  <th className="px-6 py-3 font-medium">PRODUCTO</th>
                  <th className="px-4 py-3 text-right font-medium">UNIDADES</th>
                  <th className="px-4 py-3 text-right font-medium">INGRESOS</th>
                  <th className="px-4 py-3 text-right font-medium">COSTO</th>
                  <th className="px-4 py-3 text-right font-medium">GANANCIA</th>
                  <th className="px-4 py-3 text-right font-medium">MARGEN %</th>
                  <th className="px-6 py-3 font-medium">CONTRIBUCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {/* Estado vacio: el periodo no tuvo ventas */}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-text-secondary">
                      No hay ventas en este período.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.producto_id} className="border-t border-border">
                    <td className="px-6 py-3 font-medium">{r.nombre}</td>
                    <td className="px-4 py-3 text-right">{r.unidades}</td>
                    <td className="px-4 py-3 text-right">{formatCOP(Number(r.ingresos))}</td>
                    <td className="px-4 py-3 text-right">{formatCOP(Number(r.costo))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-sena">{formatCOP(Number(r.ganancia))}</td>
                    <td className="px-4 py-3 text-right">{formatPercent(Number(r.margen))}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-border">
                          {/* El ancho de la barra es el porcentaje de contribucion (limitado entre 0 y 100) */}
                          <div
                            className="h-2 rounded-full bg-sena"
                            style={{ width: `${Math.min(100, Math.max(0, Number(r.contribucion)))}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-secondary">{formatPercent(Number(r.contribucion))}</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Fila de totales (solo si hay productos) */}
                {rows.length > 0 && (
                  <tr className="border-t border-border bg-sena-soft font-semibold">
                    <td className="px-6 py-3">TOTAL</td>
                    <td className="px-4 py-3 text-right">{totalUnits}</td>
                    <td className="px-4 py-3 text-right">{formatCOP(Number(totals.ingresos))}</td>
                    <td className="px-4 py-3 text-right">{formatCOP(Number(totals.costo))}</td>
                    <td className="px-4 py-3 text-right text-sena-hover">{formatCOP(Number(totals.ganancia))}</td>
                    <td className="px-4 py-3 text-right">{formatPercent(Number(totals.margen))}</td>
                    <td className="px-6 py-3">100%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
