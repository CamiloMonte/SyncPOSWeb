import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Search, Download, Plus, Pencil, Power } from 'lucide-react'
import Button from '../components/Button'
import Modal from '../components/Modal'
import StatusPill from '../components/StatusPill'
import { useInventoryStore } from '../store/useInventoryStore'
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
  // ESTADO GLOBAL (Zustand): useInventoryStore
  // Los productos, categorias, filtros, pagina y el estado de las peticiones viven en el
  // store (src/store/useInventoryStore.js). Aqui solo los LEEMOS con selectores.
  // ---------------------------------------------------------------

  // HOOK: useInventoryStore con selectores. useShallow permite leer varios valores a la vez
  // devolviendo un objeto: compara campo por campo y solo redibuja si alguno cambio de verdad.
  const { products, categories, meta, loading, error, saving, formError, fieldErrors, togglingId, page } =
    useInventoryStore(
      useShallow((state) => ({
        products: state.products,
        categories: state.categories,
        meta: state.meta,
        loading: state.loading,
        error: state.error,
        saving: state.saving,
        formError: state.formError,
        fieldErrors: state.fieldErrors,
        togglingId: state.togglingId,
        page: state.page,
      })),
    )
  // Los filtros se leen de uno en uno: son valores simples (texto), no hace falta useShallow.
  const searchFilter = useInventoryStore((state) => state.filters.search)
  const categoryId = useInventoryStore((state) => state.filters.categoryId)

  // Acciones del store: son funciones estables, seleccionarlas no provoca re-dibujos.
  const fetchCategories = useInventoryStore((state) => state.fetchCategories)
  const fetchProducts = useInventoryStore((state) => state.fetchProducts)
  const setSearchFilter = useInventoryStore((state) => state.setSearch)
  const setCategory = useInventoryStore((state) => state.setCategory)
  const setPage = useInventoryStore((state) => state.setPage)
  const saveProduct = useInventoryStore((state) => state.saveProduct)
  const toggleProduct = useInventoryStore((state) => state.toggleProduct)
  const setFormError = useInventoryStore((state) => state.setFormError)
  const clearFormErrors = useInventoryStore((state) => state.clearFormErrors)

  // ---------------------------------------------------------------
  // ESTADO LOCAL (useState)
  // Zustand no reemplaza a useState: lo que solo le importa a este componente sigue aqui.
  // ---------------------------------------------------------------

  // Lo que el usuario escribe en el cuadro de busqueda (al instante, tecla por tecla).
  // Empieza con el filtro que ya tenga el store, para que ambos coincidan al volver a la pagina.
  const [search, setSearch] = useState(searchFilter)

  // Modal de crear / editar (abierto o cerrado, producto en edicion y campos del formulario)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null) // null = producto nuevo
  const [form, setForm] = useState(emptyForm)

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
    fetchCategories()
  }, [fetchCategories])

  // 2) Debounce de la busqueda. Se queda en el componente a proposito: es un asunto de la
  // interfaz (esperar a que el usuario deje de teclear), no un dato de negocio del store.
  // Problema: si pedimos a la API en cada tecla ("c", "co", "coc", "coca") hacemos muchas
  // peticiones inutiles. Solucion: esperar 400 ms despues de la ultima tecla y SOLO entonces
  // llamar a setSearchFilter (accion del store, que ademas vuelve a la pagina 1).
  // Si el usuario escribe otra letra antes, la funcion de limpieza cancela el temporizador anterior.
  useEffect(() => {
    const timer = setTimeout(() => setSearchFilter(search), SEARCH_DELAY)

    // Cleanup: se ejecuta antes del siguiente efecto y al desmontar el componente
    return () => clearTimeout(timer)
  }, [search, setSearchFilter])

  // 3) Cargar los productos cada vez que cambie la pagina, la categoria o la busqueda
  // (ya con debounce). fetchProducts() lee los filtros del store con get(), asi que aqui
  // solo decidimos CUANDO pedirlos. Las respuestas viejas se descartan dentro del store
  // (contador requestId), por eso este efecto ya no necesita la variable "ignore".
  useEffect(() => {
    fetchProducts()
  }, [fetchProducts, page, categoryId, searchFilter])

  // ---------------------------------------------------------------
  // FUNCIONES (manejadores de eventos)
  // ---------------------------------------------------------------

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    clearFormErrors()
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
    clearFormErrors()
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

    // La peticion, el manejo de saving y de los errores 422 los hace la accion del store.
    // Devuelve true si se guardo: entonces cerramos el modal.
    const ok = await saveProduct(body, editingId)
    if (ok) setModalOpen(false)
  }

  // Activar / desactivar un producto (la API no permite borrar, solo desactivar)
  async function toggleActive(id) {
    // La accion del store actualiza la lista con map (inmutable). Devuelve un mensaje si fallo.
    const message = await toggleProduct(id)
    if (message) alert(message)
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
          onChange={(e) => setCategory(e.target.value)}
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
          <Button variant="danger" onClick={fetchProducts}>Reintentar</Button>
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
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                className="px-3 py-1.5 text-xs"
                disabled={loading || meta.current_page >= meta.last_page}
                onClick={() => setPage(page + 1)}
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
