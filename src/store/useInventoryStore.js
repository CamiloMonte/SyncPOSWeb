import { create } from 'zustand'
import { api } from '../services/api'

// =====================================================================
// STORE: useInventoryStore  (lista de productos del Inventario)
// ---------------------------------------------------------------------
// PROPOSITO
//   Guardar los productos que vienen de la API, sus filtros, la pagina y el estado de las
//   peticiones (cargando, error, guardando). Las acciones hacen las llamadas a la API.
//
// ESTADO
//   products    -> productos de la pagina actual
//   meta        -> datos de paginacion que entrega Laravel (current_page, last_page, total...)
//   categories  -> categorias para el filtro y el formulario
//   filters     -> { search, categoryId } ('' = sin filtro)
//   page        -> numero de pagina que se pide a la API
//   loading     -> true mientras se carga la lista
//   error       -> mensaje si fallo la carga de la lista ('' = sin error)
//   saving      -> true mientras se envia el formulario de crear/editar
//   formError   -> mensaje general del modal ('' = sin mensaje)
//   fieldErrors -> errores 422 por campo: { precio_venta: ['mensaje'] }
//   togglingId  -> id del producto que se esta activando/desactivando (null = ninguno)
//   requestId   -> contador interno para descartar respuestas viejas (ver fetchProducts)
//
// ACCIONES
//   fetchCategories, fetchProducts, setSearch, setCategory, setPage,
//   saveProduct, toggleProduct, setFormError, clearFormErrors
//
// QUIEN LO USA
//   Solo pages/Inventory.jsx.
//
// PERSIST: este store NO usa persist a proposito. El inventario (precios, stock) cambia
// en el servidor con cada venta; si se guardara en localStorage, al recargar el cajero o el
// admin veria datos viejos. Siempre debe venir fresco de la API.
//
// LO QUE NO ESTA AQUI: el formulario del modal (campos, si esta abierto) y el texto que se
// escribe en el buscador. Solo le importan a Inventory.jsx, asi que siguen en useState.
// =====================================================================

// STORE: create((set, get) => ({ ... })) devuelve el hook useInventoryStore.
//   set(parcial) -> mezcla el objeto con el estado actual (merge de primer nivel) y avisa
//                   a los componentes suscritos. Se envian objetos/arreglos NUEVOS: nunca se
//                   modifica el estado directamente (inmutabilidad).
//   get()        -> lee el estado actual dentro de una accion (por ejemplo los filtros).
export const useInventoryStore = create((set, get) => ({
  // ---- Estado inicial ----
  products: [],
  meta: null,
  categories: [],
  filters: { search: '', categoryId: '' },
  page: 1,
  loading: true,
  error: '',
  saving: false,
  formError: '',
  fieldErrors: {},
  togglingId: null,
  requestId: 0,

  // ---- Acciones ----

  // Carga las categorias (se llama una vez al abrir la pagina)
  fetchCategories: async () => {
    try {
      const response = await api.get('/categorias')
      // Laravel envuelve la lista dentro de la propiedad "data"
      set({ categories: response.data })
    } catch {
      // Si falla, el filtro y el formulario quedan sin categorias; la lista de productos
      // sigue funcionando y mostrara su propio error si el servidor no responde.
    }
  },

  // Carga la lista usando los filtros y la pagina que hay AHORA en el store (get()).
  fetchProducts: async () => {
    const { filters, page } = get()

    // CONDICION DE CARRERA (race condition): si el usuario cambia un filtro mientras una
    // peticion sigue en camino, podrian llegar las respuestas en desorden y una respuesta
    // vieja pisaria a la nueva. Solucion: cada peticion recibe un numero (myId). Al llegar
    // la respuesta solo se usa si su numero sigue siendo el ultimo; si no, se descarta.
    // Es el mismo trabajo que hacia la variable "ignore" del useEffect, pero dentro del store.
    const myId = get().requestId + 1
    set({ requestId: myId, loading: true, error: '' })

    try {
      // URLSearchParams arma el texto "?buscar=coca&page=2" y codifica bien los caracteres especiales
      const params = new URLSearchParams({ page })
      if (filters.search) params.set('buscar', filters.search)
      if (filters.categoryId) params.set('categoria_id', filters.categoryId)

      const response = await api.get(`/productos?${params}`)

      // Respuesta vieja: otra peticion salio despues, se descarta
      if (get().requestId !== myId) return
      set({ products: response.data, meta: response.meta, loading: false })
    } catch (err) {
      if (get().requestId !== myId) return
      set({ error: err.message, loading: false })
    }
  },

  // Cambiar el texto de busqueda: la pagina vuelve a 1. El componente la llama ya con debounce.
  setSearch: (search) => {
    // Si el texto no cambio no hacemos nada (asi no se pierde la pagina actual al abrir la pagina)
    if (get().filters.search === search) return
    // Spread: copia de los filtros con solo "search" cambiado (inmutabilidad)
    set((state) => ({ filters: { ...state.filters, search }, page: 1 }))
  },

  // Cambiar de categoria: tambien volvemos a la pagina 1
  setCategory: (categoryId) => {
    set((state) => ({ filters: { ...state.filters, categoryId }, page: 1 }))
  },

  setPage: (page) => set({ page }),

  // Mensajes del modal (el componente los usa para su validacion minima y al abrir el modal)
  setFormError: (message) => set({ formError: message }),
  clearFormErrors: () => set({ formError: '', fieldErrors: {} }),

  // Crea (POST) o edita (PUT) un producto. Devuelve true si salio bien y false si fallo,
  // para que el componente decida si cierra el modal.
  // "data" ya viene con los numeros convertidos (lo arma el formulario del componente).
  saveProduct: async (data, id) => {
    set({ saving: true, formError: '', fieldErrors: {} })

    try {
      // POST crea un producto nuevo; PUT reemplaza los datos de uno existente
      if (id) {
        await api.put(`/productos/${id}`, data)
      } else {
        await api.post('/productos', data)
      }
      set({ saving: false })

      // Volvemos a pedir la pagina actual a la API en lugar de modificar la lista a mano.
      // El servidor decide el orden, la paginacion, los calculos (ganancia, margen,
      // stock_bajo) y si el producto sigue cumpliendo los filtros activos.
      get().fetchProducts()
      return true
    } catch (err) {
      // 422 = Laravel rechazo los datos. "errors" trae un arreglo de mensajes por campo.
      if (err.status === 422 && err.errors) {
        // Los detalles se ven debajo de cada campo; arriba solo una pista general.
        set({ saving: false, fieldErrors: err.errors, formError: 'Revisa los campos marcados en rojo.' })
      } else {
        // Mensaje general arriba del modal para errores que no son de validacion
        set({ saving: false, formError: err.message })
      }
      return false
    }
  },

  // Activar / desactivar un producto (la API no permite borrar, solo desactivar).
  // Devuelve null si salio bien o el mensaje de error si fallo (el componente lo muestra).
  toggleProduct: async (id) => {
    set({ togglingId: id }) // deshabilita el boton de esa fila mientras dura la peticion
    try {
      const response = await api.patch(`/productos/${id}/estado`)
      // INMUTABILIDAD: map crea un arreglo NUEVO; el producto que coincide se reemplaza por
      // el que devolvio la API y los demas se dejan igual.
      set((state) => ({
        products: state.products.map((p) => (p.id === id ? response.data : p)),
        togglingId: null,
      }))
      return null
    } catch (err) {
      set({ togglingId: null })
      return err.message
    }
  },
}))
