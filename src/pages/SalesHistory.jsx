import { useEffect, useState } from 'react'
import { Search, Eye } from 'lucide-react'
import Button from '../components/Button'
import Drawer from '../components/Drawer'
import StatusPill from '../components/StatusPill'
import { api } from '../services/api'
import { formatCOP } from '../utils/format'

const selectClass = 'h-10 rounded-lg border border-border bg-surface px-3'

// Milisegundos que esperamos despues de la ultima tecla antes de buscar en la API
const SEARCH_DELAY = 400

// Convierte la fecha ISO que envia Laravel ("2026-10-21T02:23:00+00:00") en un texto legible.
// new Date(...) interpreta el texto y toLocaleString lo muestra segun el idioma y la zona
// horaria del navegador. Con 'es-CO' queda como "21/10/2026, 02:23 a. m.".
function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// La API envia el medio de pago en minuscula ("efectivo", "nequi").
// Ponemos la primera letra en mayuscula para mostrarlo en pantalla.
function formatMethod(method) {
  return method.charAt(0).toUpperCase() + method.slice(1)
}

// Etiqueta de tipo de venta: "online" (llego directo) u "offline" (se hizo sin internet y se sincronizo despues)
function SaleTypePill({ origin }) {
  const isOffline = origin === 'offline'
  return (
    <StatusPill status={isOffline ? 'offline' : 'online'}>
      {isOffline ? 'Sincronizada Offline' : 'Online'}
    </StatusPill>
  )
}

export default function SalesHistory() {
  // ---------------------------------------------------------------
  // ESTADO (useState)
  // Cada useState guarda un dato que, al cambiar, hace que React vuelva a dibujar la pagina.
  // ---------------------------------------------------------------

  // Datos de la lista que vienen de la API
  const [sales, setSales] = useState([]) // ventas de la pagina actual
  const [meta, setMeta] = useState(null) // datos de paginacion (pagina actual, total, desde, hasta...)

  // Estado de la carga de la lista
  const [loading, setLoading] = useState(true) // true mientras esperamos la respuesta
  const [error, setError] = useState('') // mensaje si la peticion falla ('' = sin error)

  // Filtros y paginacion ('' significa "sin filtro")
  const [search, setSearch] = useState('') // texto del cuadro de busqueda (cambia con cada tecla)
  const [debouncedSearch, setDebouncedSearch] = useState('') // el mismo texto, pero con retraso (es el que se envia a la API)
  const [method, setMethod] = useState('') // '' | 'efectivo' | 'nequi'
  const [origin, setOrigin] = useState('') // '' | 'online' | 'offline'
  const [cashierId, setCashierId] = useState('') // '' = todos los cajeros; si no, el id del cajero
  const [cashiers, setCashiers] = useState([]) // cajeros para el filtro (si falla la carga, queda vacio y el filtro se oculta)
  const [dateFrom, setDateFrom] = useState('') // fecha inicial en formato YYYY-MM-DD
  const [dateTo, setDateTo] = useState('') // fecha final en formato YYYY-MM-DD
  const [page, setPage] = useState(1) // numero de pagina que se pide a la API

  // Sirve para volver a pedir la lista sin cambiar ningun filtro (boton "Reintentar")
  const [reloadKey, setReloadKey] = useState(0)

  // Detalle de una venta (Drawer)
  const [selectedId, setSelectedId] = useState(null) // id de la venta abierta (null = Drawer cerrado)
  const [detail, setDetail] = useState(null) // venta completa que devuelve GET /ventas/{id}
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailReloadKey, setDetailReloadKey] = useState(0) // para reintentar el detalle

  // ---------------------------------------------------------------
  // EFECTOS (useEffect)
  // useEffect ejecuta codigo DESPUES de que React dibuja la pagina. Sirve para cosas
  // "externas" como pedir datos a un servidor. El arreglo del final (dependencias) dice
  // cuando se vuelve a ejecutar: [] solo al montar; [a, b] al montar y cada vez que cambien a o b.
  // ---------------------------------------------------------------

  // 0) Cargar los cajeros UNA sola vez para el filtro "Cajero"
  useEffect(() => {
    let ignore = false

    async function loadCashiers() {
      try {
        const response = await api.get('/usuarios?rol=cajero')
        if (!ignore) setCashiers(response.data)
      } catch {
        // Si falla, el filtro se oculta y el historial sigue funcionando
      }
    }

    loadCashiers()

    return () => {
      ignore = true
    }
  }, [])

  // 1) Debounce de la busqueda.
  // Si pedimos a la API en cada tecla hacemos muchas peticiones inutiles. La solucion es
  // esperar a que el usuario deje de escribir 400 ms: cada vez que "search" cambia se
  // programa un temporizador y la funcion de limpieza (cleanup) cancela el anterior con
  // clearTimeout. Solo el ultimo temporizador llega a ejecutarse.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      // Volvemos a la pagina 1: si estabamos en la 3 y la nueva busqueda solo tiene
      // 1 pagina, pediriamos una pagina que ya no existe y la tabla saldria vacia.
      setPage(1)
    }, SEARCH_DELAY)

    return () => clearTimeout(timer)
  }, [search])

  // 2) Cargar la lista cada vez que cambie la pagina, algun filtro (la busqueda ya con
  // debounce) o "reloadKey" (nuestra forma de pedir una recarga manual).
  useEffect(() => {
    // "ignore" descarta respuestas viejas: si el usuario cambia un filtro mientras llega
    // la respuesta anterior, esa respuesta lenta no debe pisar a la mas reciente.
    let ignore = false

    async function loadSales() {
      setLoading(true)
      setError('')

      try {
        // URLSearchParams arma el texto "?page=2&metodo_pago=nequi" y codifica bien los caracteres especiales.
        // Solo agregamos los filtros que tienen valor para no enviar parametros vacios.
        const params = new URLSearchParams({ page })
        if (debouncedSearch) params.set('buscar', debouncedSearch)
        if (method) params.set('metodo_pago', method)
        if (origin) params.set('origen', origin)
        if (cashierId) params.set('user_id', cashierId)
        if (dateFrom) params.set('desde', dateFrom)
        if (dateTo) params.set('hasta', dateTo)

        const response = await api.get(`/ventas?${params}`)

        if (ignore) return
        setSales(response.data)
        setMeta(response.meta)
      } catch (err) {
        if (!ignore) setError(err.message)
      } finally {
        // finally se ejecuta siempre, haya salido bien o mal: aqui apagamos el "cargando"
        if (!ignore) setLoading(false)
      }
    }

    loadSales()

    // Cleanup: React lo ejecuta antes de repetir el efecto o al desmontar el componente
    return () => {
      ignore = true
    }
  }, [page, debouncedSearch, method, origin, cashierId, dateFrom, dateTo, reloadKey])

  // 3) Cargar el detalle SOLO cuando se abre el Drawer (cuando selectedId deja de ser null).
  // La lista ya trae los productos de cada venta, pero pedir GET /ventas/{id} garantiza que
  // el detalle siempre este fresco y es el patron habitual cuando las listas no incluyen todo.
  useEffect(() => {
    // Drawer cerrado: no hay nada que pedir
    if (selectedId === null) return

    let ignore = false // evita que la respuesta de una venta anterior pise a la actual

    async function loadDetail() {
      setDetailLoading(true)
      setDetailError('')
      setDetail(null) // limpiamos la venta anterior para no mostrar datos de otra factura

      try {
        const response = await api.get(`/ventas/${selectedId}`)
        if (!ignore) setDetail(response.data)
      } catch (err) {
        if (!ignore) setDetailError(err.message)
      } finally {
        if (!ignore) setDetailLoading(false)
      }
    }

    loadDetail()

    return () => {
      ignore = true
    }
  }, [selectedId, detailReloadKey])

  // ---------------------------------------------------------------
  // FUNCIONES (manejadores de eventos)
  // ---------------------------------------------------------------

  // Cada vez que cambia un filtro volvemos a la pagina 1, por la misma razon que en la
  // busqueda: la nueva lista puede tener menos paginas que la pagina donde estabamos.
  function handleMethodChange(value) {
    setMethod(value)
    setPage(1)
  }

  function handleOriginChange(value) {
    setOrigin(value)
    setPage(1)
  }

  function handleCashierChange(value) {
    setCashierId(value)
    setPage(1)
  }

  function handleDateFromChange(value) {
    setDateFrom(value)
    setPage(1)
  }

  function handleDateToChange(value) {
    setDateTo(value)
    setPage(1)
  }

  // Pide de nuevo la lista actual (boton "Reintentar")
  function reload() {
    setReloadKey((key) => key + 1)
  }

  // Pide de nuevo el detalle de la venta abierta
  function reloadDetail() {
    setDetailReloadKey((key) => key + 1)
  }

  // Cierra el Drawer y limpia el detalle
  function closeDetail() {
    setSelectedId(null)
    setDetail(null)
    setDetailError('')
  }

  // ---------------------------------------------------------------
  // VALORES CALCULADOS (se recalculan en cada dibujo, no necesitan useState)
  // ---------------------------------------------------------------

  // Laravel envia los decimales como texto ("13500.00"): Number() los convierte para poder sumar.
  // reduce recorre el arreglo acumulando un valor (aqui, la suma).
  const items = detail?.items ?? []
  const units = items.reduce((sum, item) => sum + item.cantidad, 0)
  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0)

  return (
    <div className="space-y-6">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search size={16} className="absolute top-3 left-3 text-text-secondary" />
          {/* Input controlado: su valor viene del estado "search" y cada tecla lo actualiza */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por N° de factura o cajero..."
            className="h-10 w-full rounded-lg border border-border bg-surface pr-3 pl-9 outline-none focus:border-sena"
          />
        </div>
        <select value={method} onChange={(e) => handleMethodChange(e.target.value)} className={selectClass}>
          <option value="">Medio de pago: Todos</option>
          <option value="efectivo">Efectivo</option>
          <option value="nequi">Nequi</option>
        </select>
        <select value={origin} onChange={(e) => handleOriginChange(e.target.value)} className={selectClass}>
          <option value="">Tipo: Todos</option>
          <option value="online">Online</option>
          <option value="offline">Sincronizada Offline</option>
        </select>
        {/* El filtro de cajero solo se dibuja si la lista de cajeros cargo bien */}
        {cashiers.length > 0 && (
          <select value={cashierId} onChange={(e) => handleCashierChange(e.target.value)} className={selectClass}>
            <option value="">Cajero: Todos</option>
            {cashiers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        {/* type="date" muestra un calendario y entrega el valor como "YYYY-MM-DD", el formato que espera la API */}
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          Desde
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => handleDateFromChange(e.target.value)}
            className={selectClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          Hasta
          <input
            type="date"
            value={dateTo}
            onChange={(e) => handleDateToChange(e.target.value)}
            className={selectClass}
          />
        </label>
      </div>

      {/* Caja roja de error con boton para reintentar (renderizado condicional con &&) */}
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-danger bg-danger-bg px-4 py-3 text-sm text-danger-text">
          <span>{error}</span>
          <Button variant="danger" onClick={reload}>Reintentar</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-background text-xs text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">N° VENTA</th>
              <th className="px-4 py-3 font-medium">CAJERO</th>
              <th className="px-4 py-3 font-medium">HORA (SOLD_AT)</th>
              <th className="px-4 py-3 font-medium">MEDIO DE PAGO</th>
              <th className="px-4 py-3 font-medium">TIPO</th>
              <th className="px-4 py-3 text-right font-medium">TOTAL</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {/* Renderizado condicional: segun el estado se muestra UNA de estas filas o la lista */}
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">Cargando ventas...</td>
              </tr>
            )}
            {!loading && !error && sales.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                  No se encontraron ventas con esos filtros.
                </td>
              </tr>
            )}
            {!loading &&
              sales.map((s) => (
                // key debe ser unico y estable: usamos el id que viene de la base de datos
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{s.numero}</td>
                  <td className="px-4 py-3">{s.cajero.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatDateTime(s.vendida_en)}</td>
                  <td className="px-4 py-3">{formatMethod(s.metodo_pago)}</td>
                  <td className="px-4 py-3">
                    <SaleTypePill origin={s.origen} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCOP(Number(s.total))}</td>
                  <td className="px-4 py-3">
                    {/* Al hacer clic solo guardamos el id: el efecto 3 se encarga de pedir el detalle */}
                    <button onClick={() => setSelectedId(s.id)} className="flex items-center gap-1 font-medium text-sena">
                      <Eye size={16} /> Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* Pie con paginacion: solo se dibuja cuando ya llegaron los datos de "meta" */}
        {meta && (
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

      {/* Detalle de la factura seleccionada. Se abre de inmediato; el contenido depende del estado de la carga */}
      <Drawer open={selectedId !== null} title="Detalle de Factura" onClose={closeDetail}>
        {detailLoading && (
          <p className="p-6 text-center text-sm text-text-secondary">Cargando detalle...</p>
        )}

        {detailError && (
          <div className="m-6 flex items-center justify-between gap-4 rounded-lg border border-danger bg-danger-bg px-4 py-3 text-sm text-danger-text">
            <span>{detailError}</span>
            <Button variant="danger" onClick={reloadDetail}>Reintentar</Button>
          </div>
        )}

        {detail && (
          <>
            <div className="flex-1 space-y-5 p-6">
              <p className="text-2xl font-bold">{detail.numero}</p>
              <div className="space-y-2 rounded-lg bg-background p-4 text-sm">
                <div className="flex justify-between"><span className="text-text-secondary">Cajero</span><span className="font-medium">{detail.cajero.name}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Fecha y hora</span><span className="font-medium">{formatDateTime(detail.vendida_en)}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Medio de pago</span><span className="font-medium">{formatMethod(detail.metodo_pago)}</span></div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Tipo</span>
                  <SaleTypePill origin={detail.origen} />
                </div>
                {/* sincronizada_en indica cuando una venta hecha offline llego al servidor; es null en ventas online */}
                {detail.sincronizada_en && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Sincronizada</span>
                    <span className="font-medium">{formatDateTime(detail.sincronizada_en)}</span>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold">Productos ({items.length})</h3>
                <ul className="mt-2 divide-y divide-border">
                  {items.map((item) => (
                    <li key={item.producto_id} className="flex justify-between py-3">
                      <div>
                        <p className="font-medium">{item.nombre}</p>
                        <p className="text-xs text-text-secondary">{item.cantidad} × {formatCOP(Number(item.precio_unitario))}</p>
                      </div>
                      <p className="font-semibold">{formatCOP(Number(item.subtotal))}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2 border-t border-border pt-4 text-sm">
                <div className="flex justify-between"><span className="text-text-secondary">Subtotal</span><span>{formatCOP(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Unidades</span><span>{units}</span></div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-2xl font-bold text-sena">{formatCOP(subtotal)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 border-t border-border p-6">
              {/* window.print() abre el cuadro de impresion del navegador */}
              <Button variant="secondary" className="flex-1" onClick={() => window.print()}>Imprimir</Button>
              {/* Sin librerias extra: el mismo cuadro de impresion permite elegir "Guardar como PDF" como destino */}
              <Button className="flex-1" onClick={() => window.print()}>Descargar PDF</Button>
            </div>
          </>
        )}
      </Drawer>
    </div>
  )
}
