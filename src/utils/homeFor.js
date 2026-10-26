// Devuelve la URL de inicio de cada rol.
// Se usa en varios lugares (Login, "/" y RoleRoute), por eso vive en un archivo aparte.
// Si estuviera dentro de App.jsx, los componentes que App importa tendrian que importar
// a App de vuelta (importacion circular) y eso da errores.
export function homeFor(user) {
  return user.rol === 'admin' ? '/dashboard' : '/punto-de-venta'
}
