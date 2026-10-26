# SyncPOS

Panel web de punto de venta (POS) e inventario, hecho con React como proyecto de aprendizaje del SENA.
Todas las pantallas leen y guardan sus datos en una API de Laravel (ver "Instalación en otro computador").

## Instalación en otro computador

Esta web necesita la **API de Laravel** funcionando: [CamiloMonte/SyncPOSBackend](https://github.com/CamiloMonte/SyncPOSBackend).
**Instala primero el backend** siguiendo su README (XAMPP, base de datos `syncpos`, `php artisan serve`).

### 1. Programas necesarios (una sola vez)

| Programa | Para qué | Versión |
|---|---|---|
| **Git** | Descargar el proyecto | Cualquiera |
| **Node.js** | Ejecutar la web | **20.19 o superior** (Vite 8 lo exige). Descarga la versión **LTS** |

### 2. Descargar y ejecutar

En **otra** terminal de Git Bash (la del backend debe quedar abierta con `php artisan serve`):

```bash
cd ~/Desktop
git clone https://github.com/CamiloMonte/SyncPOSWeb.git
cd SyncPOSWeb
npm install                  # instala las dependencias (solo la primera vez)
cp .env.example .env         # define la dirección de la API
npm run dev                  # abre la web en http://localhost:5173
```

El archivo `.env` trae la dirección de la API (Vite solo expone las variables que empiezan por `VITE_`):

```
VITE_API_URL=http://127.0.0.1:8000/api
```

Si cambias el `.env`, reinicia `npm run dev`.

### 3. Entrar

Abre **http://localhost:5173**. Usuarios de prueba (contraseña `password`):

| Rol | Correo |
|---|---|
| Administrador | `admin@syncpos.co` |
| Cajero | `cajero@syncpos.co` |

El rol lo define la API: el administrador entra al Dashboard y el cajero al Punto de Venta.

**¿Está todo bien conectado?** En el login, la píldora debe decir 🟢 **"Servidor Conectado (MySQL)"**.

| La píldora dice | Qué revisar |
|---|---|
| 🔴 "Sin conexión con el servidor" | Que `php artisan serve` esté corriendo en la carpeta del backend |
| 🔴 "Base de datos sin conexión" | Que MySQL esté encendido en XAMPP y los datos del `.env` del backend |

### Errores comunes

| Error | Solución |
|---|---|
| `npm install` falla por la versión | Node.js es muy viejo: instala la versión LTS |
| `npm` "no se reconoce como comando" | Cierra y vuelve a abrir la terminal después de instalar Node.js |
| La página carga pero no deja iniciar sesión | La API no está encendida (ver la píldora) |

### Uso diario (después de instalarlo)

1. Backend encendido (`php artisan serve` con MySQL de XAMPP).
2. En la carpeta de la web: `npm run dev`.

### Otros comandos

```bash
npm run build   # genera la versión para producción (carpeta dist/)
npm run lint    # revisa el código en busca de errores
```

Todas las peticiones pasan por `src/services/api.js`. El token y el usuario se guardan con
Zustand (`useAuthStore` + `persist`) en `localStorage`, por eso la sesión sigue activa al recargar la página
(ver "Manejo de estado").

Toda la app está conectada a la API: sesión, inventario, punto de venta, historial, dashboard,
reportes y mis ventas. Ya no hay datos de ejemplo (se eliminó `mockData.js`).

## Estructura de carpetas

```
src/
  main.jsx          Punto de entrada: monta React y envuelve la app en BrowserRouter.
  App.jsx           Tabla central de rutas y layout (Sidebar + Header). La sesión se lee de useAuthStore.
  index.css         Tailwind CSS y los colores del diseño (@theme).
  store/            Estado global con Zustand: useAuthStore.js, useCartStore.js, useInventoryStore.js.
  services/api.js   Único archivo que usa fetch; lee el token con useAuthStore.getState().
  utils/format.js   Funciones auxiliares, como formatCOP() para mostrar pesos.
  utils/dates.js    Fechas locales YYYY-MM-DD, rangos de reportes y formato dd/mm/aaaa.
  utils/homeFor.js  homeFor(): URL de inicio según el rol del usuario.
  components/       Piezas reutilizables: Sidebar, Header, ProtectedRoute, RoleRoute, Button, Modal, Drawer, KpiCard, StatusPill, ServerStatus (indicador en vivo del servidor).
  pages/            Una pantalla por archivo.
                    Administrador: Dashboard, Inventory, Reports, SalesHistory, Users.
                    Cajero: CashierPos, CashierSales. Además, Login.
```

## Navegación y rutas

La app usa **react-router-dom v7**. `BrowserRouter` está en `main.jsx` y la tabla de rutas en `App.jsx`.

| URL | Rol | Página |
| --- | --- | --- |
| `/login` | Público (con sesión redirige al inicio del rol) | Login |
| `/` | Cualquiera | Redirige al inicio del rol o a `/login` |
| `/dashboard` | Administrador | Dashboard General |
| `/inventario` | Administrador | Inventario y Productos |
| `/reportes` | Administrador | Reportes Financieros |
| `/historial` | Administrador | Historial de Ventas |
| `/usuarios` | Administrador | Gestión de Usuarios (crear, editar, activar/desactivar cuentas) |
| `/punto-de-venta` | Cajero | Punto de Venta |
| `/mis-ventas` | Cajero | Mis Ventas del Día |
| `*` | Cualquiera | Redirige a `/` |

Guardias de acceso (en `src/components/`):

- **`ProtectedRoute`**: si no hay sesión, redirige a `/login`; si la hay, muestra las rutas hijas con `<Outlet />`.
- **`RoleRoute`** (prop `allow`): si el rol del usuario no coincide, lo redirige a su propia página de inicio (administrador a `/dashboard`, cajero a `/punto-de-venta`).

El menú lateral usa `NavLink` y el Header toma su título de la misma tabla de rutas con `useLocation()`.

**Producción**: al ser una SPA, el servidor debe redirigir cualquier ruta desconocida a `index.html` (por ejemplo `try_files $uri /index.html;` en Nginx). El servidor de desarrollo de Vite ya lo hace; sin esa regla, recargar `/inventario` daría 404.

## Conceptos de React que se usan

- **Componentes**: funciones que devuelven JSX (por ejemplo `KpiCard`).
- **Props**: datos que un componente recibe de su padre (`<Button variant="primary">`).
- **useState**: memoria de un componente (texto de búsqueda, formulario del modal, dinero recibido).
- **Zustand**: estado compartido entre varios componentes (sesión, carrito, inventario). Ver "Manejo de estado".
- **map()**: dibuja una lista de elementos a partir de un arreglo.
- **Renderizado condicional**: `{condicion && <Algo />}` muestra algo solo si se cumple la condición.
- **React Router**: cada pantalla tiene su URL (ver la sección "Navegación y rutas").

## Próximos pasos

1. Guardar el cierre de caja en la base de datos (nuevo endpoint en Laravel, por ejemplo POST /cierres-caja).
2. Guardar las ventas sin conexión (IndexedDB o localStorage) y sincronizarlas al volver el internet.
3. Conectar el lector de códigos de barras o la cámara en el botón "Escanear Código".

## Manejo de estado

La app usa **Zustand 5** (`npm install zustand`) para el estado que de verdad es global. Los stores
están en `src/store/`. Regla de la guía: *Zustand no reemplaza a `useState`*; lo que solo le importa a un
componente (texto de un input, modal abierto, dinero recibido) sigue siendo estado local.

Reglas que se cumplen en todo el código: se usan **selectores** (`useAuthStore((s) => s.user)`, nunca el
store completo), `useShallow` cuando se leen varios valores a la vez, y las actualizaciones son
**inmutables** (spread, `map`, `filter`; nunca `push`).

### useAuthStore (`src/store/useAuthStore.js`)

| | |
|---|---|
| **Propósito** | Guardar quién inició sesión y su token. |
| **Estado** | `user` (`{ id, name, email, rol }`), `token`, `loading`, `error` |
| **Acciones** | `login(email, password)`, `logout()`, `logoutLocal()`, `isAuthenticated()`, `clearError()` |
| **Componentes que lo usan** | `App`, `Login`, `Header`, `Sidebar`, `ProtectedRoute`, `RoleRoute`, `Users` y `services/api.js` |
| **¿Usa persist?** | Sí (`syncpos-auth`), solo `user` y `token` (`partialize`). Así la sesión sobrevive a recargar la página. Nunca se guarda la contraseña. Nota: un token en `localStorage` puede ser leído por scripts (XSS); en producción se prefiere una cookie `httpOnly`. |

### useCartStore (`src/store/useCartStore.js`)

| | |
|---|---|
| **Propósito** | La venta en curso del cajero y su registro en la API. |
| **Estado** | `items` (`[{ product, qty }]`), `paymentMethod`, `saving`, `error`, `lastSale` |
| **Acciones** | `addProduct`, `increment`, `decrement`, `remove`, `clear`, `setPaymentMethod`, `registerSale()`, `clearResult()`. Selectores derivados: `selectTotal`, `selectUnits` |
| **Componentes que lo usan** | `CashierPos` |
| **¿Usa persist?** | Sí (`syncpos-cart`), solo `items` y `paymentMethod`. Si el cajero recarga la página en medio de una venta, el carrito no se pierde. `saving`, `error` y `lastSale` empiezan limpios. |

### useInventoryStore (`src/store/useInventoryStore.js`)

| | |
|---|---|
| **Propósito** | Lista de productos del inventario, filtros, paginación y CRUD contra la API. |
| **Estado** | `products`, `meta`, `categories`, `filters` (`search`, `categoryId`), `page`, `loading`, `error`, `saving`, `formError`, `fieldErrors`, `togglingId` |
| **Acciones** | `fetchCategories`, `fetchProducts`, `setSearch`, `setCategory`, `setPage`, `saveProduct(data, id?)`, `toggleProduct(id)` |
| **Componentes que lo usan** | `Inventory` |
| **¿Usa persist?** | No. El inventario cambia en el servidor con cada venta; debe venir siempre fresco de la API. |

### Antes vs. ahora

**Antes:** `App.jsx` guardaba el usuario en un `useState` y lo pasaba por props a `Header`, `Sidebar`,
`ProtectedRoute` y `RoleRoute` (prop drilling), junto con `onLogin` y `onLogout`. `Users` y `api.js`
leían la sesión con helpers propios de `localStorage` (`saveSession`, `getSession`, `clearSession`), y
un 401 avisaba a `App` con un evento de `window` (`syncpos:logout`).

**Ahora:** cada componente lee solo lo que necesita desde `useAuthStore`. `App` ya no tiene estado de
sesión ni pasa props. Cuando `logout()` o un 401 dejan el token en `null`, `ProtectedRoute` se redibuja
y redirige a `/login` sin eventos.

`api.js` no es un componente, así que no puede usar el hook. Lee el token con
`useAuthStore.getState().token` y, ante un 401, llama a `useAuthStore.getState().logoutLocal()` (solo
borra la sesión local; llamar a `logout()` pediría `POST /logout` con un token inválido y entraría en un ciclo).

### Ver los stores en DevTools

1. Abre las herramientas de desarrollo (F12) → **Application** → **Local Storage** → `http://localhost:5173`.
2. Después de iniciar sesión aparece `syncpos-auth` con `user` y `token`.
3. Como cajero, agrega productos al carrito: aparece `syncpos-cart`. Recarga la página (F5) y el carrito sigue ahí.
4. Al cerrar sesión, `user` y `token` quedan en `null`.

El análisis de qué datos son globales y cuáles locales está en [`docs/analisis-estado.md`](docs/analisis-estado.md).

## Estado del servidor y usuarios

- El indicador de la esquina superior (y del Login) consulta `GET /api/estado` al abrir la página, cada 30 segundos y cuando el navegador pierde o recupera la red. Muestra "Servidor Conectado (MySQL)", "Base de datos sin conexión" o "Sin conexión con el servidor".
- La página `/usuarios` (solo administrador) permite crear cajeros y administradores, editarlos, cambiar su contraseña y activarlos o desactivarlos. Los usuarios no se borran: se desactivan, y su sesión se cierra de inmediato.
