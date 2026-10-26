import { useEffect, useRef, useState } from 'react'
import { Barcode, ScanLine, Package, Trash2, Minus, Plus, Send } from 'lucide-react'
import Button from '../components/Button'
import { api } from '../services/api'
import { formatCOP } from '../utils/format'

// Milisegundos que esperamos despues de la ultima tecla antes de buscar en la API
const SEARCH_DELAY = 400

// Metodos de pago. "value" es lo que espera la API; "label" es lo que ve el cajero.
const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'nequi', label: 'Nequi' },
]

export default function CashierPos() {
  // ---------------------------------------------------------------
  // ESTADO (useState)
  // Cada useState guarda un dato que, al cambiar, hace que React vuelva a dibujar la pagina.
  // ---------------------------------------------------------------

  // Datos que vienen de la API
  const [products, setProducts] = useState([]) // productos de la pagina actual del catalogo
  const [categories, setCategories] = useState([]) // categorias para los chips
  const [meta, setMeta] = useState(null) // datos de paginacion (pagina actual, ultima pagina...)

  // Estado de la carga del catalogo
  const [loading, setLoading] = useState(true) // true mientras esperamos la respuesta
  const [error, setError] = useState('') // mensaje si la peticion falla ('' = sin error)

  // Filtros y paginacion
  const [search, setSearch] = useState('') // lo que el cajero escribe (al instante)
  const [debouncedSearch, setDebouncedSearch] = useState('') // el mismo texto pero con retraso (el que se envia a la API)
  const [categoryId, setCategoryId] = useState('') // '' = todas las categorias
  const [page, setPage] = useState(1) // numero de pagina que se pide a la API

  // Sirve para volver a pedir el catalogo sin cambiar ningun filtro (ver el useEffect de productos)
  const [reloadKey, setReloadKey] = useState(0)

  // Venta en curso
  const [cart, setCart] = useState([]) // lista de { product, qty } (product es el objeto que entrega la API)
  const [payment, setPayment] = useState('efectivo') // 'efectivo' o 'nequi'
  const [received, setReceived] = useState('') // dinero recibido (texto, porque viene de un <input>)

  // Registro de la venta
  const [saving, setSaving] = useState(false) // true mientras se envia la venta al servidor
  const [saleError, setSaleError] = useState('') // mensaje de error del panel de venta
  const [saleSuccess, setSaleSuccess] = useState('') // mensaje verde de venta registrada

  // useRef guarda una referencia a un elemento del HTML (aqui, el cuadro de busqueda).
  // A diferencia de useState, cambiar un ref NO vuelve a dibujar la pagina.
  const searchInputRef = useRef(null)

  // ---------------------------------------------------------------
  // EFECTOS (useEffect)
  // useEffect ejecuta codigo DESPUES de que React dibuja la pagina. Sirve para cosas
  // "externas" como pedir datos a un servidor. El arreglo del final (dependencias) dice
  // cuando se vuelve a ejecutar:
  //   []        -> solo una vez, al montar el componente
  //   [a, b]    -> al montar y cada vez que "a" o "b" cambien
  // ---------------------------------------------------------------

  // 1) Cargar las categorias UNA sola vez (dependencias vacias)
  useEffect(() => {
    // "ignore" evita actualizar el estado si el componente ya se desmonto
    // antes de que llegara la respuesta.
    let ignore = false

    async function loadCategories() {
      try {
        const response = await api.get('/categorias')
        // Laravel envuelve la lista dentro de la propiedad "data"
        if (!ignore) setCategories(response.data)
      } catch {
        // Si falla, solo se ve el chip "Todas"; el catalogo muestra su propio error si el servidor no responde.
      }
    }

    loadCategories()

    // Funcion de limpieza (cleanup): React la ejecuta cuando el componente se desmonta
    return () => {
      ignore = true
    }
  }, [])

  // 2) Debounce de la busqueda.
  // Si pidieramos datos a la API en cada tecla ("c", "co", "coc", "coca") hariamos muchas
  // peticiones inutiles. Solucion: esperar a que el cajero deje de escribir 400 ms.
  // Cada vez que "search" cambia, programamos con setTimeout la actualizacion de
  // "debouncedSearch". Si llega otra tecla antes de los 400 ms, la funcion de limpieza
  // ejecuta clearTimeout y cancela el temporizador anterior: solo el ultimo se ejecuta.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) // una busqueda nueva siempre empieza en la primera pagina
    }, SEARCH_DELAY)

    // Cleanup: se ejecuta antes del siguiente efecto y al desmontar el componente
    return () => clearTimeout(timer)
  }, [search])

  // 3) Cargar el catalogo cada vez que cambie la pagina, la categoria, la busqueda
  // (ya con debounce) o "reloadKey" (nuestra forma de pedir una recarga manual).
  useEffect(() => {
    let ignore = false

    async function loadProducts() {
      setLoading(true)
      setError('')

      try {
        // URLSearchParams arma el texto "?solo_activos=1&buscar=coca" y codifica bien los caracteres especiales.
        // solo_activos=1: el cajero nunca debe ver productos desactivados.
        const params = new URLSearchParams({ solo_activos: '1', page })
        if (debouncedSearch) params.set('buscar', debouncedSearch)
        if (categoryId) params.set('categoria_id', categoryId)

        const response = await api.get(`/productos?${params}`)

        // Si mientras esperabamos cambio algun filtro, esta respuesta ya es vieja: se descarta.
        if (ignore) return
        setProducts(response.data)
        setMeta(response.meta)
      } catch (err) {
        if (!ignore) setError(err.message)
      } finally {
        // finally se ejecuta siempre, haya salido bien o mal: aqui apagamos el "cargando"
        if (!ignore) setLoading(false)
      }
    }

    loadProducts()

    return () => {
      ignore = true
    }
  }, [page, categoryId, debouncedSearch, reloadKey])

  // ---------------------------------------------------------------
  // FUNCIONES (manejadores de eventos)
  // ---------------------------------------------------------------

  // Cambiar de categoria: tambien volvemos a la pagina 1
  function handleCategoryChange(value) {
    setCategoryId(value)
    setPage(1)
  }

  // Pide de nuevo el catalogo actual (boton "Reintentar" y despues de vender)
  function reload() {
    setReloadKey((key) => key + 1)
  }

  // Agrega un producto al carrito (o suma 1 si ya existe) sin superar el stock.
  // Usamos la forma funcional setCart((current) => ...) para partir siempre del valor mas reciente.
  // INMUTABILIDAD: nunca se modifica el arreglo del estado; se crea uno NUEVO (con map o con
  // el operador spread "...") y React detecta el cambio para volver a dibujar.
  function addToCart(product) {
    // Sin stock no se puede vender
    if (product.stock <= 0) return

    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id)

      if (!existing) return [...current, { product, qty: 1 }]

      // Validamos contra el stock en el navegador solo para dar una buena experiencia;
      // el servidor vuelve a validarlo al registrar la venta, asi que esta no es la unica defensa.
      if (existing.qty >= product.stock) return current

      return current.map((item) => (item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item))
    })
  }

  // Cambia la cantidad (+1 o -1). Si llega a 0, el producto sale del carrito.
  function changeQty(productId, delta) {
    setCart((current) =>
      current
        // map: devuelve un arreglo nuevo; solo el item que coincide recibe la cantidad nueva
        .map((item) => {
          if (item.product.id !== productId) return item
          // Math.min impide pasar del stock disponible (el servidor lo valida de nuevo)
          return { ...item, qty: Math.min(item.qty + delta, item.product.stock) }
        })
        // filter: descarta los items cuya cantidad llego a 0
        .filter((item) => item.qty > 0),
    )
  }

  // filter devuelve un arreglo nuevo sin el producto indicado
  function removeItem(productId) {
    setCart((current) => current.filter((item) => item.product.id !== productId))
  }

  // El boton "Escanear Codigo" solo pone el cursor en el cuadro de busqueda.
  // Un lector de codigos de barras USB funciona como un teclado: "escribe" el codigo
  // y luego pulsa Enter. Por eso basta con tener el foco en el input (ver handleSearchKeyDown).
  function focusSearch() {
    searchInputRef.current?.focus()
  }

  // Al pulsar Enter en el cuadro de busqueda (lo que hace el lector al terminar de leer):
  // si el codigo coincide EXACTAMENTE con un producto, lo agregamos al carrito.
  async function handleSearchKeyDown(e) {
    if (e.key !== 'Enter') return

    const code = search.trim()
    if (!code) return

    try {
      // Preguntamos directamente a la API (no usamos la lista en pantalla) porque el lector
      // escribe muy rapido y la lista con debounce podria no haberse actualizado todavia.
      const params = new URLSearchParams({ solo_activos: '1', buscar: code })
      const response = await api.get(`/productos?${params}`)

      // "buscar" tambien encuentra coincidencias parciales por nombre, asi que exigimos igualdad exacta
      const matches = response.data.filter((p) => p.codigo_barras === code)
      if (matches.length === 1) {
        addToCart(matches[0])
        setSearch('') // dejamos el cuadro listo para el siguiente producto
      }
    } catch {
      // Si falla, no hacemos nada: el catalogo ya muestra su propio error si el servidor no responde.
    }
  }

  // Registra la venta en el servidor
  async function registerSale() {
    setSaving(true)
    setSaleError('')
    setSaleSuccess('')

    try {
      // Solo enviamos el id y la cantidad de cada producto, NUNCA los precios ni el total.
      // El servidor toma los precios de la base de datos y calcula el total el mismo;
      // asi nadie puede alterar un precio desde el navegador.
      const response = await api.post('/ventas', {
        metodo_pago: payment,
        items: cart.map((item) => ({ producto_id: item.product.id, cantidad: item.qty })),
      })

      // Mostramos el numero y el total que devuelve el SERVIDOR: es la fuente de verdad
      // (el precio pudo cambiar mientras el cajero armaba el carrito).
      const sale = response.data
      setSaleSuccess(`Venta ${sale.numero} registrada por ${formatCOP(Number(sale.total))}`)

      // La venta termino: limpiamos el carrito y el valor recibido
      setCart([])
      setReceived('')

      // Volvemos a pedir el catalogo porque el stock cambio con esta venta.
      // Si no, la pantalla seguiria mostrando existencias que ya no son reales.
      reload()
    } catch (err) {
      // 422 = el servidor rechazo la venta (por ejemplo, stock insuficiente). Su primer
      // mensaje es el mas claro; si no existe, usamos el mensaje general del error.
      // El carrito NO se borra para que el cajero pueda corregirlo y reintentar.
      setSaleError(err.errors?.items?.[0] ?? err.message)
    } finally {
      // finally se ejecuta siempre: aqui habilitamos de nuevo el boton
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------
  // VALORES CALCULADOS (se recalculan en cada dibujo, no necesitan useState)
  // Si guardaramos el total en un useState tendriamos que acordarnos de actualizarlo
  // cada vez que cambie el carrito y podria quedar desfasado. Calculado a partir del
  // carrito, siempre es correcto.
  // ---------------------------------------------------------------

  // reduce recorre el carrito acumulando un valor. Number(): la API envia el precio como texto ("13500.00").
  const total = cart.reduce((sum, item) => sum + Number(item.product.precio_venta) * item.qty, 0)
  const units = cart.reduce((sum, item) => sum + item.qty, 0)
  const receivedAmount = Number(received || 0)
  const change = Math.max(0, receivedAmount - total) // nunca negativo
  const missing = total - receivedAmount // cuanto falta si el cliente entrego menos del total

  // En efectivo, el valor recibido debe cubrir el total antes de poder registrar
  const cashIsShort = payment === 'efectivo' && missing > 0
  const cannotRegister = cart.length === 0 || saving || cashIsShort

  return (
    <div className="flex gap-6">
      {/* Catalogo */}
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Barcode size={16} className="absolute top-3 left-3 text-text-secondary" />
            {/* Input controlado: su valor viene del estado "search" y cada tecla lo actualiza */}
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar por nombre o código de barras..."
              className="h-10 w-full rounded-lg border border-border bg-surface pr-3 pl-9 outline-none focus:border-sena"
            />
          </div>
          <Button icon={ScanLine} onClick={focusSearch}>
            Escanear Código
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Chip fijo "Todas" (id vacio) mas un chip por cada categoria que llego de la API */}
          {[{ id: '', nombre: 'Todas' }, ...categories].map((chip) => (
            <button
              key={chip.id}
              onClick={() => handleCategoryChange(chip.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                categoryId === chip.id ? 'bg-sena text-white' : 'border border-border bg-surface text-text-secondary'
              }`}
            >
              {chip.nombre}
            </button>
          ))}
        </div>

        {/* Caja roja de error con boton para reintentar (renderizado condicional con &&) */}
        {error && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-danger bg-danger-bg px-4 py-3 text-sm text-danger-text">
            <span>{error}</span>
            <Button variant="danger" onClick={reload}>Reintentar</Button>
          </div>
        )}

        {/* Segun el estado se muestra UNO de estos mensajes o la cuadricula de productos */}
        {loading && <p className="py-10 text-center text-sm text-text-secondary">Cargando productos...</p>}
        {!loading && !error && products.length === 0 && (
          <p className="py-10 text-center text-sm text-text-secondary">No se encontraron productos.</p>
        )}

        {!loading && (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3 min-[1500px]:grid-cols-4">
            {products.map((p) => {
              // Un producto sin existencias no se puede vender
              const soldOut = p.stock <= 0
              return (
                // key debe ser unico y estable: usamos el id que viene de la base de datos
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={soldOut}
                  className="rounded-xl border border-border bg-surface p-3 text-left hover:border-sena disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border"
                >
                  <div className="flex h-20 items-center justify-center rounded-lg bg-sena-soft text-sena">
                    <Package size={32} />
                  </div>
                  <p className="mt-3 truncate text-sm font-semibold">{p.nombre}</p>
                  {/* "?." (encadenamiento opcional) evita un error si el producto no tiene categoria */}
                  <p className="text-xs text-text-secondary">{p.categoria?.nombre}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-bold">{formatCOP(Number(p.precio_venta))}</span>
                    {soldOut ? (
                      <span className="text-xs font-semibold text-danger">Agotado</span>
                    ) : (
                      <span className={`text-xs ${p.stock_bajo ? 'text-danger' : 'text-text-secondary'}`}>
                        Stock {p.stock}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Paginacion: solo aparece si hay mas de una pagina de resultados */}
        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <p>Página {meta.current_page} de {meta.last_page}</p>
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

      {/* Venta actual */}
      <div className="flex w-[400px] shrink-0 flex-col self-start overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-start justify-between p-5">
          <div>
            <h2 className="text-lg font-semibold">Venta actual</h2>
            {/* Operador ternario para el plural: 1 producto / 2 productos */}
            <p className="text-xs text-text-secondary">
              {cart.length} {cart.length === 1 ? 'producto' : 'productos'} · {units} {units === 1 ? 'unidad' : 'unidades'}
            </p>
          </div>
          <button onClick={() => setCart([])} className="text-sm font-medium text-danger">Vaciar</button>
        </div>

        <div className="max-h-[360px] min-h-[160px] space-y-3 overflow-y-auto px-5 pb-5">
          {cart.length === 0 && (
            <p className="py-10 text-center text-sm text-text-secondary">Toca un producto para agregarlo</p>
          )}
          {cart.map(({ product, qty }) => (
            <div key={product.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{product.nombre}</p>
                  <p className="text-xs text-text-secondary">{formatCOP(Number(product.precio_venta))} c/u</p>
                </div>
                <button
                  onClick={() => removeItem(product.id)}
                  className="rounded-lg bg-danger-bg p-1.5 text-danger"
                  aria-label="Quitar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => changeQty(product.id, -1)} className="rounded-lg border border-border p-1.5">
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center font-semibold">{qty}</span>
                  {/* Se deshabilita al llegar al stock disponible */}
                  <button
                    onClick={() => changeQty(product.id, 1)}
                    disabled={qty >= product.stock}
                    className="rounded-lg bg-sena p-1.5 text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <span className="font-bold">{formatCOP(Number(product.precio_venta) * qty)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 bg-background p-5">
          {/* Mensaje verde con el resultado de la ultima venta (viene del servidor) */}
          {saleSuccess && (
            <div className="rounded-lg border border-sena bg-sena-soft px-4 py-3 text-sm font-medium text-sena-hover">
              {saleSuccess}
            </div>
          )}
          {/* Mensaje rojo si el servidor rechazo la venta o no hubo conexion */}
          {saleError && (
            <div className="rounded-lg border border-danger bg-danger-bg px-4 py-3 text-sm text-danger-text">
              {saleError}
            </div>
          )}

          <div className="flex justify-between text-sm text-text-secondary">
            <span>Subtotal</span><span>{formatCOP(total)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total a Cobrar</span>
            <span className="text-[28px] font-bold">{formatCOP(total)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => setPayment(m.value)}
                className={`rounded-lg py-2 text-sm font-semibold ${
                  payment === m.value ? 'bg-sena text-white' : 'border border-border bg-surface text-text-secondary'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Solo en efectivo se pide el valor recibido y se calcula el cambio */}
          {payment === 'efectivo' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-text-secondary">
                  Recibido
                  <input
                    type="number"
                    value={received}
                    onChange={(e) => setReceived(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-dark"
                  />
                </label>
                <div className="text-xs font-medium text-text-secondary">
                  Cambio
                  <p className="mt-1 flex h-10 items-center text-lg font-bold text-sena">{formatCOP(change)}</p>
                </div>
              </div>
              {/* Aviso cuando lo recibido no alcanza (solo si ya hay algo en el carrito) */}
              {cart.length > 0 && cashIsShort && (
                <p className="text-sm font-semibold text-danger">Falta {formatCOP(missing)}</p>
              )}
            </div>
          )}

          {/* Mientras se guarda, el boton se deshabilita para evitar enviar la venta dos veces */}
          <Button icon={Send} disabled={cannotRegister} onClick={registerSale} className="h-14 w-full text-base">
            {saving ? 'Registrando...' : 'REGISTRAR VENTA'}
          </Button>
          <p className="text-center text-xs text-text-secondary">Atajos: F2 escanear · F9 cobrar · Esc cancelar</p>
        </div>
      </div>
    </div>
  )
}
