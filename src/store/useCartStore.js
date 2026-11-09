import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../services/api'

// =====================================================================
// STORE: useCartStore  (carrito del cajero en el Punto de Venta)
// ---------------------------------------------------------------------
// PROPOSITO
//   Guardar la venta en curso: que productos hay en el carrito, cuantas unidades de
//   cada uno y con que metodo de pago se cobra. Tambien registra la venta en la API.
//
// ESTADO
//   items         -> lista de { product, qty }. "product" guarda solo los datos que
//                    necesita el carrito: id, nombre, precio_venta, stock, codigo_barras
//   paymentMethod -> 'efectivo' | 'nequi'
//   saving        -> true mientras se envia la venta al servidor
//   error         -> mensaje de error del ultimo intento de registrar ('' = sin error)
//   lastSale      -> { numero, total } de la ultima venta registrada (datos del SERVIDOR) o null
//
// ACCIONES
//   addProduct, increment, decrement, remove, clear, setPaymentMethod,
//   registerSale (async), clearResult
//
// VALORES DERIVADOS (selectores exportados al final): selectTotal y selectUnits
//
// QUIEN LO USA
//   Solo pages/CashierPos.jsx. Es global (un store) y no un useState porque el carrito
//   debe sobrevivir a una recarga de la pagina (ver persist abajo).
// =====================================================================

// Convierte el producto que entrega la API en el objeto minimo que guardamos en el carrito.
// Asi el localStorage no se llena de campos que no se usan (categoria, ganancia, etc.).
function toCartProduct(product) {
  return {
    id: product.id,
    nombre: product.nombre,
    precio_venta: product.precio_venta,
    stock: product.stock,
    codigo_barras: product.codigo_barras,
  }
}

// STORE: create((set, get) => ({ ... })) devuelve el hook useCartStore.
//   set(parcial)  -> mezcla el objeto con el estado actual y avisa a los componentes suscritos.
//   set(fn)       -> fn recibe el estado actual y devuelve lo que cambia (forma funcional).
//   get()         -> lee el estado actual dentro de una accion.
// INMUTABILIDAD: nunca se modifica items directamente. Siempre se crea un arreglo NUEVO con
// spread (...), map o filter; asi Zustand detecta el cambio y React vuelve a dibujar.
export const useCartStore = create(
  persist(
    (set, get) => ({
      // ---- Estado inicial ----
      items: [],
      paymentMethod: 'efectivo',
      saving: false,
      error: '',
      lastSale: null,

      // ---- Acciones ----

      // Agrega un producto (o suma 1 si ya esta) sin superar el stock.
      addProduct: (product) => {
        // Sin stock no se puede vender
        if (product.stock <= 0) return

        set((state) => {
          const existing = state.items.find((item) => item.product.id === product.id)

          // Producto nuevo: copia del arreglo + el item nuevo al final (spread, no push)
          if (!existing) {
            return { items: [...state.items, { product: toCartProduct(product), qty: 1 }] }
          }

          // Validamos contra el stock en el navegador solo para dar buena experiencia;
          // el servidor vuelve a validarlo al registrar la venta.
          if (existing.qty >= product.stock) return state

          // Ya existe: map devuelve un arreglo nuevo y solo ese item cambia su cantidad
          return {
            items: state.items.map((item) =>
              item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item,
            ),
          }
        })
      },

      // +1 a la cantidad de un producto, sin pasar del stock
      increment: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.product.id === id ? { ...item, qty: Math.min(item.qty + 1, item.product.stock) } : item,
          ),
        })),

      // -1 a la cantidad. Si llega a 0, el producto sale del carrito (filter).
      decrement: (id) =>
        set((state) => ({
          items: state.items
            .map((item) => (item.product.id === id ? { ...item, qty: item.qty - 1 } : item))
            .filter((item) => item.qty > 0),
        })),

      // filter devuelve un arreglo nuevo sin el producto indicado
      remove: (id) => set((state) => ({ items: state.items.filter((item) => item.product.id !== id) })),

      // Vacia el carrito
      clear: () => set({ items: [] }),

      setPaymentMethod: (method) => set({ paymentMethod: method }),

      // Borra el mensaje de la ultima venta y el error (el POS lo llama al abrirse)
      clearResult: () => set({ lastSale: null, error: '' }),

      // Registra la venta en el servidor. Devuelve la venta ({ numero, total, ... }) o null si fallo.
      registerSale: async () => {
        // get() lee el carrito actual dentro de la accion
        const { items, paymentMethod } = get()

        set({ saving: true, error: '', lastSale: null })
        try {
          // Solo enviamos el id y la cantidad de cada producto, NUNCA los precios ni el total.
          // El servidor toma los precios de la base de datos y calcula el total el mismo;
          // asi nadie puede alterar un precio desde el navegador.
          const response = await api.post('/ventas', {
            metodo_pago: paymentMethod,
            items: items.map((item) => ({ producto_id: item.product.id, cantidad: item.qty })),
          })

          // El numero y el total que devuelve el SERVIDOR son la fuente de verdad
          // (el precio pudo cambiar mientras el cajero armaba el carrito).
          const sale = response.data
          // La venta termino: se limpia el carrito y se guarda el resumen
          set({ items: [], saving: false, lastSale: { numero: sale.numero, total: sale.total } })
          return sale
        } catch (err) {
          // 422 = el servidor rechazo la venta (por ejemplo, stock insuficiente).
          // El carrito NO se borra para que el cajero pueda corregirlo y reintentar.
          set({ saving: false, error: err.errors?.items?.[0] ?? err.message })
          return null
        }
      },
    }),
    {
      // Llave en localStorage (DevTools -> Application -> Local Storage)
      name: 'syncpos-cart',

      // partialize: solo se guardan los items y el metodo de pago.
      // JUSTIFICACION: si el cajero recarga la pagina (F5) o se cierra la pestana en medio de
      // una venta, el carrito NO debe perderse. saving, error y lastSale son temporales:
      // al recargar deben empezar limpios.
      partialize: (state) => ({ items: state.items, paymentMethod: state.paymentMethod }),
    },
  ),
)

// ---- Selectores de valores derivados ----
// Un selector es una funcion (state) => valor. Se usa asi: useCartStore(selectTotal).
// El total y las unidades NO se guardan en el store: se calculan a partir de items.
// Si se guardaran, habria que acordarse de actualizarlos en cada accion y podrian quedar
// desfasados. Como son funciones exportadas, varios componentes pueden reutilizarlas.
// El selector devuelve un numero (valor primitivo), por eso el componente solo se redibuja
// cuando ese numero cambia.

// Number(): la API envia el precio como texto ("13500.00")
export const selectTotal = (state) =>
  state.items.reduce((sum, item) => sum + Number(item.product.precio_venta) * item.qty, 0)

export const selectUnits = (state) => state.items.reduce((sum, item) => sum + item.qty, 0)
