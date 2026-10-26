import { useEffect, useState } from 'react'
import { Search, Download, Plus, Pencil, Power } from 'lucide-react'
import Button from '../components/Button'
import Modal from '../components/Modal'
import StatusPill from '../components/StatusPill'
import { api } from '../services/api'
import { formatCOP } from '../utils/format'

// Formulario vacio para "Nuevo Producto".
// Usamos los MISMOS nombres de campo que la API de Laravel (codigo_barras, precio_compra...).
// Asi no hay que "traducir" campos al enviar o recibir datos: menos codigo y menos errores.
// Todos los valores son texto porque asi trabajan los <input>; se convierten a numero al guardar.
const emptyForm = {
  codigo_barras: '',
  nombre: '',
  categoria_id: '',
  precio_compra: '',
  precio_venta: '',
  stock: '',
  stock_minimo: '',
}

const inputClass = 'mt-1.5 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-sena'

// Texto rojo pequeno que se muestra debajo de un campo con error de validacion
const fieldErrorClass = 'mt-1 text-xs font-normal text-danger'

// Milisegundos que esperamos despues de la ultima tecla antes de buscar en la API
const SEARCH_DELAY = 400

export default function Inventory() {
  // ---------------------------------------------------------------
  // ESTADO (useState)
  // Cada useState guarda un dato que, al cambiar, hace que React vuelva a dibujar la pagina.
  // ---------------------------------------------------------------

  // Datos que vienen de la API
  const [products, setProducts] = useState([]) // productos de la pagina actual
  const [categories, setCategories] = useState([]) // categorias para el filtro y el formulario
  const [meta, setMeta] = useState(null) // datos de paginacion (pagina actual, total, desde, hasta...)

  // Estado de la carga de la lista
  const [loading, setLoading] = useState(true) // true mientras esperamos la respuesta
  const [error, setError] = useState('') // mensaje si la peticion falla ('' = sin error)

  // Filtros y paginacion
  const [search, setSearch] = useState('') // lo que el usuario escribe en el cuadro de busqueda (al instante)
  const [debouncedSearch, setDebouncedSearch] = useState('') // el mismo texto, pero con retraso (es el que se envia a la API)
  const [categoryId, setCategoryId] = useState('') // '' = todas las categorias
  const [page, setPage] = useState(1) // numero de pagina que se pide a la API

  // Sirve para volver a pedir la lista sin cambiar ningun filtro (ver el useEffect de productos)
  const [reloadKey, setReloadKey] = useState(0)

  // Boton de activar/desactivar: guardamos el id del producto que se esta procesando
  const [togglingId, setTogglingId] = useState(null)

  // Modal de crear / editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null) // null = producto nuevo
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false) // true mientras se envia el formulario
  const [formError, setFormError] = useState('') // mensaje general de error del modal
  const [fieldErrors, setFieldErrors] = useState({}) // errores 422 por campo: { precio_venta: ['mensaje'] }

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
        // Si falla, el filtro y el formulario quedan sin categorias; la lista de productos
        // sigue funcionando y mostrara su propio error si el servidor no responde.
      }
    }

    loadCategories()

    // Funcion de limpieza (cleanup): React la ejecuta cuando el componente se desmonta
    return () => {
      ignore = true
    }
  }, [])

  // 2) Debounce de la busqueda.
  // Problema: si pedimos a la API en cada tecla ("c", "co", "coc", "coca") hacemos muchas
  // peticiones inutiles. Solucion: esperar a que el usuario deje de escribir 400 ms.
  // Cada vez que "search" cambia, programamos con setTimeout una actualizacion de
  // "debouncedSearch". Si el usuario escribe otra letra antes de que pasen los 400 ms,
  // la funcion de limpieza ejecuta clearTimeout y cancela el temporizador anterior.
  // Solo el ultimo temporizador llega a ejecutarse.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) // una busqueda nueva siempre empieza en la primera pagina
    }, SEARCH_DELAY)

    // Cleanup: se ejecuta antes del siguiente efecto y al desmontar el componente
    return () => clearTimeout(timer)
  }, [search])

  // 3) Cargar los productos cada vez que cambie la pagina, la categoria, la busqueda
  // (ya con debounce) o "reloadKey" (nuestra forma de pedir "recarga" manual).
  useEffect(() => {
    let ignore = false

    async function loadProducts() {
      setLoading(true)
      setError('')

      try {
        // URLSearchParams arma el texto "?buscar=coca&page=2" y codifica bien los caracteres especiales
        const params = new URLSearchParams({ page })
        if (debouncedSearch) params.set('buscar', debouncedSearch)
        if (categoryId) params.set('categoria_id', categoryId)

        const response = await api.get(`/productos?${params}`)

        // Si mientras esperabamos cambio algun filtro, esta respuesta ya es vieja: se descarta.
        // Asi evitamos que una respuesta lenta pise a una mas reciente.
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

  // Pide de nuevo la lista actual (boton "Reintentar" y despues de guardar)
  function reload() {
    setReloadKey((key) => key + 1)
  }

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setFieldErrors({})
    setModalOpen(true)
  }

  function openEdit(product) {
    setEditingId(product.id)
    // Rellenamos el formulario con los datos del producto.
    // Los inputs trabajan con texto, por eso convertimos los numeros con String().
    // Number() primero: la API envia "9800.00" y queremos mostrar "9800".
    setForm({
      codigo_barras: product.codigo_barras,
      nombre: product.nombre,
      categoria_id: String(product.categoria?.id ?? ''),
      precio_compra: String(Number(product.precio_compra)),
      precio_venta: String(Number(product.precio_venta)),
      stock: String(product.stock),
      stock_minimo: String(product.stock_minimo),
    })
    setFormError('')
    setFieldErrors({})
    setModalOpen(true)
  }

  // Actualiza un solo campo del formulario sin perder los demas.
  // Usamos la forma funcional (previous => nuevo) para partir siempre del valor mas reciente.
  function updateField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  // Genera un codigo de 13 digitos que empieza por 770
  function generateBarcode() {
    let code = '770'
    for (let i = 0; i < 10; i++) code += Math.floor(Math.random() * 10)
    updateField('codigo_barras', code)
  }

  async function handleSave() {
    // Validacion minima en el navegador: todos los campos son obligatorios.
    // La validacion "de verdad" la hace Laravel; esta solo ahorra una peticion inutil.
    const complete =
      form.codigo_barras &&
      form.nombre &&
      form.categoria_id &&
      form.precio_compra !== '' &&
      form.precio_venta !== '' &&
      form.stock !== '' &&
      form.stock_minimo !== ''
    if (!complete) {
      setFormError('Completa todos los campos obligatorios (*).')
      return
    }

    // Cuerpo de la peticion: los campos numericos se envian como numeros, no como texto
    const body = {
      codigo_barras: form.codigo_barras,
      nombre: form.nombre,
      categoria_id: Number(form.categoria_id),
      precio_compra: Number(form.precio_compra),
      precio_venta: Number(form.precio_venta),
      stock: Number(form.stock),
      stock_minimo: Number(form.stock_minimo),
    }

    setSaving(true)
    setFormError('')
    setFieldErrors({})

    try {
      // POST crea un producto nuevo; PUT reemplaza los datos de uno existente
      if (editingId) {
        await api.put(`/productos/${editingId}`, body)
      } else {
        await api.post('/productos', body)
      }

      setModalOpen(false)

      // Volvemos a pedir la pagina actual a la API en lugar de modificar la lista a mano.
      // Es mas simple y mas seguro: el servidor decide el orden, la paginacion, los
      // calculos (ganancia, margen, stock_bajo) y si el producto sigue cumpliendo los
      // filtros activos. Si lo hicieramos a mano tendriamos que repetir toda esa logica
      // en el navegador y podria quedar distinta de lo que realmente hay en la base de datos.
      reload()
    } catch (err) {
      // 422 = Laravel rechazo los datos. "errors" trae un arreglo de mensajes por campo.
      if (err.status === 422 && err.errors) {
        setFieldErrors(err.errors)
        // Los detalles ya se ven debajo de cada campo, asi que arriba solo damos una pista general.
        // (El "message" de Laravel en un 422 viene en ingles: "... (and 1 more error)").
        setFormError('Revisa los campos marcados en rojo.')
      } else {
        // Mensaje general arriba del modal para errores que no son de validacion
        setFormError(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  // Activar / desactivar un producto (la API no permite borrar, solo desactivar)
  async function toggleActive(id) {
    setTogglingId(id) // deshabilita el boton de esa fila mientras dura la peticion
    try {
      const response = await api.patch(`/productos/${id}/estado`)
      // INMUTABILIDAD: en React nunca se modifica el estado directamente (products[0].activo = ...).
      // Se crea un arreglo NUEVO con map: el producto que coincide se reemplaza por el que
      // devolvio la API y los demas se dejan igual. React detecta que es un arreglo distinto
      // y vuelve a dibujar la tabla.
      setProducts((current) => current.map((p) => (p.id === id ? response.data : p)))
    } catch (err) {
      alert(err.message)
    } finally {
      setTogglingId(null)
    }
  }

  // ---------------------------------------------------------------
  // VALORES CALCULADOS (se recalculan en cada dibujo, no necesitan useState)
  // ---------------------------------------------------------------

  // Ganancia y margen calculados en vivo en el formulario
  const unitProfit = Number(form.precio_venta || 0) - Number(form.precio_compra || 0)
  const margin = Number(form.precio_venta) > 0 ? (unitProfit / Number(form.precio_venta)) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Barra de acciones */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute top-3 left-3 text-text-secondary" />
          {/* Input controlado: su valor viene del estado "search" y cada tecla lo actualiza */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código de barras o nombre..."
            className="h-10 w-full rounded-lg border border-border bg-surface pr-3 pl-9 outline-none focus:border-sena"
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="h-10 rounded-lg border border-border bg-surface px-3"
        >
          <option value="">Categoría: Todas</option>
          {/* .map crea un <option> por cada categoria. "key" ayuda a React a identificar cada elemento de la lista */}
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <Button variant="secondary" icon={Download}>Exportar</Button>
        <Button icon={Plus} onClick={openNew}>Nuevo Producto</Button>
      </div>

      {/* Caja roja de error con boton para reintentar (renderizado condicional con &&) */}
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-danger bg-danger-bg px-4 py-3 text-sm text-danger-text">
          <span>{error}</span>
          <Button variant="danger" onClick={reload}>Reintentar</Button>
        </div>
      )}

      {/* Tabla de productos */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-background text-xs text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">CÓDIGO DE BARRAS</th>
              <th className="px-4 py-3 font-medium">NOMBRE DEL PRODUCTO</th>
              <th className="px-4 py-3 font-medium">CATEGORÍA</th>
              <th className="px-4 py-3 text-right font-medium">PRECIO COSTO</th>
              <th className="px-4 py-3 text-right font-medium">PRECIO VENTA</th>
              <th className="px-4 py-3 text-right font-medium">GANANCIA UNID.</th>
              <th className="px-4 py-3 text-right font-medium">STOCK</th>
              <th className="px-4 py-3 font-medium">ESTADO</th>
              <th className="px-4 py-3 font-medium">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {/* Renderizado condicional: segun el estado se muestra UNA de estas filas o la lista */}
            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-text-secondary">Cargando productos...</td>
              </tr>
            )}
            {!loading && !error && products.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-text-secondary">No se encontraron productos.</td>
              </tr>
            )}
            {!loading &&
              products.map((p) => (
                // key debe ser unico y estable: usamos el id que viene de la base de datos
                <tr key={p.id} className={`border-t border-border ${p.activo ? '' : 'opacity-50'}`}>
                  <td className="px-4 py-3 text-text-secondary">{p.codigo_barras}</td>
                  <td className="px-4 py-3 font-medium">{p.nombre}</td>
                  {/* "?." (encadenamiento opcional) evita un error si el producto no tiene categoria */}
                  <td className="px-4 py-3 text-text-secondary">{p.categoria?.nombre}</td>
                  {/* Laravel envia los decimales como texto ("9800.00"); Number() los convierte a numero para poder formatearlos */}
                  <td className="px-4 py-3 text-right">{formatCOP(Number(p.precio_compra))}</td>
                  <td className="px-4 py-3 text-right">{formatCOP(Number(p.precio_venta))}</td>
                  <td className="px-4 py-3 text-right font-semibold text-sena">{formatCOP(p.ganancia_unitaria)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${p.stock_bajo ? 'text-danger' : ''}`}>{p.stock}</td>
                  <td className="px-4 py-3">
                    {/* Prioridad: inactivo, luego stock bajo, y si no, normal */}
                    {!p.activo ? (
                      <StatusPill status="neutral">Inactivo</StatusPill>
                    ) : p.stock_bajo ? (
                      <StatusPill status="danger">Stock Bajo</StatusPill>
                    ) : (
                      <StatusPill status="success">Normal</StatusPill>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(p)} className="text-text-secondary hover:text-dark" aria-label="Editar">
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => toggleActive(p.id)}
                        disabled={togglingId === p.id}
                        className="text-danger disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Activar o desactivar"
                      >
                        <Power size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* Pie con paginacion: solo se dibuja cuando ya llegaron los datos de "meta" */}
        {meta && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-text-secondary">
            <p>
              Mostrando {meta.from ?? 0}–{meta.to ?? 0} de {meta.total} productos
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

      {/* Modal de crear / editar */}
      <Modal
        open={modalOpen}
        title={editingId ? 'Editar Producto' : 'Nuevo Producto'}
        subtitle="Los campos con * son obligatorios"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            {/* Mientras se guarda, el boton se deshabilita para evitar enviar dos veces */}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar Producto'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm font-medium">
          {/* Mensaje general de error (validacion minima, 422 o error de red) */}
          {formError && (
            <div className="rounded-lg border border-danger bg-danger-bg px-4 py-3 font-normal text-danger-text">
              {formError}
            </div>
          )}
          {/* Inputs controlados: value viene del estado "form" y onChange lo actualiza */}
          <div>
            <label>Código de barras *</label>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={form.codigo_barras}
                onChange={(e) => updateField('codigo_barras', e.target.value)}
              />
              <Button variant="secondary" className="mt-1.5 h-10" onClick={generateBarcode}>Generar</Button>
            </div>
            {/* Primer mensaje de error de ese campo, si existe */}
            {fieldErrors.codigo_barras?.[0] && <p className={fieldErrorClass}>{fieldErrors.codigo_barras[0]}</p>}
          </div>
          <label className="block">
            Nombre del producto *
            <input className={inputClass} value={form.nombre} onChange={(e) => updateField('nombre', e.target.value)} />
            {fieldErrors.nombre?.[0] && <p className={fieldErrorClass}>{fieldErrors.nombre[0]}</p>}
          </label>
          <label className="block">
            Categoría *
            {/* El value de cada option es el id de la categoria: es lo que la API espera en categoria_id */}
            <select
              className={inputClass}
              value={form.categoria_id}
              onChange={(e) => updateField('categoria_id', e.target.value)}
            >
              <option value="">Selecciona una categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            {fieldErrors.categoria_id?.[0] && <p className={fieldErrorClass}>{fieldErrors.categoria_id[0]}</p>}
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              Precio de costo (COP) *
              <input
                type="number"
                className={inputClass}
                value={form.precio_compra}
                onChange={(e) => updateField('precio_compra', e.target.value)}
              />
              {fieldErrors.precio_compra?.[0] && <p className={fieldErrorClass}>{fieldErrors.precio_compra[0]}</p>}
            </label>
            <label className="block">
              Precio de venta (COP) *
              <input
                type="number"
                className={inputClass}
                value={form.precio_venta}
                onChange={(e) => updateField('precio_venta', e.target.value)}
              />
              {fieldErrors.precio_venta?.[0] && <p className={fieldErrorClass}>{fieldErrors.precio_venta[0]}</p>}
            </label>
          </div>
          <div className="rounded-lg bg-sena-soft px-4 py-3 text-sena-hover">
            Ganancia por unidad: {formatCOP(unitProfit)} · Margen {margin.toFixed(1).replace('.', ',')}%
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              Stock inicial *
              <input type="number" className={inputClass} value={form.stock} onChange={(e) => updateField('stock', e.target.value)} />
              {fieldErrors.stock?.[0] && <p className={fieldErrorClass}>{fieldErrors.stock[0]}</p>}
            </label>
            <label className="block">
              Stock mínimo *
              <input
                type="number"
                className={inputClass}
                value={form.stock_minimo}
                onChange={(e) => updateField('stock_minimo', e.target.value)}
              />
              {fieldErrors.stock_minimo?.[0] && <p className={fieldErrorClass}>{fieldErrors.stock_minimo[0]}</p>}
            </label>
          </div>
          <p className="text-xs font-normal text-text-secondary">
            Cuando el stock sea igual o menor al mínimo, el producto se marcará como "Stock Bajo".
          </p>
        </div>
      </Modal>
    </div>
  )
}
