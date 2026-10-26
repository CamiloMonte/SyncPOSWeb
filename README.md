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

Todas las peticiones pasan por `src/services/api.js`. El token y el usuario se guardan en
`localStorage`, por eso la sesión sigue activa al recargar la página.

Toda la app está conectada a la API: sesión, inventario, punto de venta, historial, dashboard,
reportes y mis ventas. Ya no hay datos de ejemplo (se eliminó `mockData.js`).

## Estructura de carpetas

```
src/
  main.jsx          Punto de entrada: monta React y envuelve la app en BrowserRouter.
  App.jsx           Tabla central de rutas, layout (Sidebar + Header) y sesión del usuario.
  index.css         Tailwind CSS y los colores del diseño (@theme).
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
- **useState**: memoria de un componente (texto de búsqueda, carrito, usuario actual).
- **map()**: dibuja una lista de elementos a partir de un arreglo.
- **Renderizado condicional**: `{condicion && <Algo />}` muestra algo solo si se cumple la condición.
- **React Router**: cada pantalla tiene su URL (ver la sección "Navegación y rutas").

## Próximos pasos

1. Guardar el cierre de caja en la base de datos (nuevo endpoint en Laravel, por ejemplo POST /cierres-caja).
2. Guardar las ventas sin conexión (IndexedDB o localStorage) y sincronizarlas al volver el internet.
3. Conectar el lector de códigos de barras o la cámara en el botón "Escanear Código".
4. Pasar el usuario con un Context cuando la app crezca.

## Estado del servidor y usuarios

- El indicador de la esquina superior (y del Login) consulta `GET /api/estado` al abrir la página, cada 30 segundos y cuando el navegador pierde o recupera la red. Muestra "Servidor Conectado (MySQL)", "Base de datos sin conexión" o "Sin conexión con el servidor".
- La página `/usuarios` (solo administrador) permite crear cajeros y administradores, editarlos, cambiar su contraseña y activarlos o desactivarlos. Los usuarios no se borran: se desactivan, y su sesión se cierra de inmediato.
