import { useEffect, useState } from 'react'
import { Search, Plus, Pencil, Power, Eye, EyeOff } from 'lucide-react'
import Button from '../components/Button'
import Modal from '../components/Modal'
import StatusPill from '../components/StatusPill'
import { api, getSession } from '../services/api'

// Formulario vacio para "Nuevo Usuario".
// Usamos los MISMOS nombres de campo que la API de Laravel (name, email, password, rol...).
const emptyForm = {
  name: '',
  email: '',
  rol: 'cajero',
  password: '',
  password_confirmation: '',
}

const inputClass = 'mt-1.5 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-sena'
const selectClass = 'h-10 rounded-lg border border-border bg-surface px-3'

// Texto rojo pequeno que se muestra debajo de un campo con error de validacion
const fieldErrorClass = 'mt-1 text-xs font-normal text-danger'

// Milisegundos que esperamos despues de la ultima tecla antes de buscar en la API
const SEARCH_DELAY = 400

// Iniciales para el circulo de color: "Laura Gomez" -> "LG"
function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

export default function Users() {
  // Usuario que tiene la sesion abierta: se usa para bloquear "desactivar mi propia cuenta"
  const currentUser = getSession()?.user

  // ---------------------------------------------------------------
  // ESTADO (useState)
  // ---------------------------------------------------------------

  // Datos que vienen de la API
  const [users, setUsers] = useState([])

  // Estado de la carga de la lista
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filtros ('' significa "sin filtro")
  const [search, setSearch] = useState('') // texto que se escribe (cambia con cada tecla)
  const [debouncedSearch, setDebouncedSearch] = useState('') // el mismo texto con retraso (el que se envia a la API)
  const [roleFilter, setRoleFilter] = useState('') // '' | 'admin' | 'cajero'
  const [statusFilter, setStatusFilter] = useState('') // '' | '1' (activos) | '0' (inactivos)

  // Sirve para volver a pedir la lista sin cambiar ningun filtro
  const [reloadKey, setReloadKey] = useState(0)

  // Boton de activar/desactivar: id del usuario que se esta procesando
  const [togglingId, setTogglingId] = useState(null)

  // Aviso verde que aparece despues de crear un usuario
  const [notice, setNotice] = useState('')

  // Modal de crear / editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null) // null = usuario nuevo
  const [form, setForm] = useState(emptyForm)
  const [showPassword, setShowPassword] = useState(false) // ojo para mostrar u ocultar la contrasena
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({}) // errores 422 por campo

  // ---------------------------------------------------------------
  // EFECTOS (useEffect)
  // ---------------------------------------------------------------

  // 1) Debounce de la busqueda: espera 400 ms despues de la ultima tecla.
  // La funcion de limpieza cancela el temporizador anterior con clearTimeout.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DELAY)
    return () => clearTimeout(timer)
  }, [search])

  // 2) Cargar la lista cuando cambie un filtro o "reloadKey"
  useEffect(() => {
    // "ignore" descarta respuestas viejas si el usuario cambio un filtro mientras esperaba
    let ignore = false

    async function loadUsers() {
      setLoading(true)
      setError('')

      try {
        // Solo agregamos los filtros que tienen valor
        const params = new URLSearchParams()
        if (debouncedSearch) params.set('buscar', debouncedSearch)
        if (roleFilter) params.set('rol', roleFilter)
        if (statusFilter) params.set('activo', statusFilter)

        const response = await api.get(`/usuarios?${params}`)
        if (!ignore) setUsers(response.data)
      } catch (err) {
        if (!ignore) setError(err.message)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadUsers()

    return () => {
      ignore = true
    }
  }, [debouncedSearch, roleFilter, statusFilter, reloadKey])

  // ---------------------------------------------------------------
  // FUNCIONES (manejadores de eventos)
  // ---------------------------------------------------------------

  // Pide de nuevo la lista actual (boton "Reintentar" y despues de guardar)
  function reload() {
    setReloadKey((key) => key + 1)
  }

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setShowPassword(false)
    setFormError('')
    setFieldErrors({})
    setModalOpen(true)
  }

  function openEdit(user) {
    setEditingId(user.id)
    // La contrasena queda vacia: en edicion solo se cambia si el admin escribe una nueva
    setForm({ name: user.name, email: user.email, rol: user.rol, password: '', password_confirmation: '' })
    setShowPassword(false)
    setFormError('')
    setFieldErrors({})
    setModalOpen(true)
  }

  // Actualiza un solo campo del formulario sin perder los demas
  function updateField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  async function handleSave() {
    // Validacion minima en el navegador; la validacion real la hace Laravel
    const complete = form.name && form.email && form.rol && (editingId || form.password)
    if (!complete) {
      setFormError('Completa todos los campos obligatorios (*).')
      return
    }

    const body = { name: form.name, email: form.email, rol: form.rol }
    // En edicion la contrasena solo se envia si se escribio una nueva
    if (form.password) {
      body.password = form.password
      body.password_confirmation = form.password_confirmation
    }

    setSaving(true)
    setFormError('')
    setFieldErrors({})

    try {
      if (editingId) {
        await api.put(`/usuarios/${editingId}`, body)
        setNotice('')
      } else {
        await api.post('/usuarios', body)
        setNotice('Usuario creado. Ya puede iniciar sesión con su correo y contraseña.')
      }

      setModalOpen(false)
      reload()
    } catch (err) {
      // 422 = Laravel rechazo los datos; "errors" trae los mensajes por campo
      if (err.status === 422 && err.errors) {
        setFieldErrors(err.errors)
        setFormError('Revisa los campos marcados en rojo.')
      } else {
        setFormError(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  // Activar / desactivar una cuenta (la API no permite borrar usuarios)
  async function toggleActive(user) {
    // Al desactivar pedimos confirmacion porque se cierra su sesion en todos sus dispositivos
    if (user.activo && !window.confirm(`¿Desactivar a ${user.name}? Se cerrará su sesión en todos sus dispositivos.`)) {
      return
    }

    setTogglingId(user.id)
    try {
      const response = await api.patch(`/usuarios/${user.id}/estado`)
      // INMUTABILIDAD: creamos un arreglo nuevo con map, reemplazando solo el usuario cambiado
      setUsers((current) => current.map((u) => (u.id === user.id ? response.data : u)))
      setNotice('')
    } catch (err) {
      alert(err.message)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra de acciones */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute top-3 left-3 text-text-secondary" />
          {/* Input controlado: su valor viene del estado "search" */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="h-10 w-full rounded-lg border border-border bg-surface pr-3 pl-9 outline-none focus:border-sena"
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectClass}>
          <option value="">Rol: Todos</option>
          <option value="admin">Administrador</option>
          <option value="cajero">Cajero</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="">Estado: Todos</option>
          <option value="1">Activos</option>
          <option value="0">Inactivos</option>
        </select>
        <Button icon={Plus} onClick={openNew}>Nuevo Usuario</Button>
      </div>

      {/* Aviso verde tras crear un usuario (renderizado condicional con &&) */}
      {notice && (
        <div className="rounded-lg border border-online bg-online-bg px-4 py-3 text-sm text-online-text">{notice}</div>
      )}

      {/* Caja roja de error con boton para reintentar */}
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-danger bg-danger-bg px-4 py-3 text-sm text-danger-text">
          <span>{error}</span>
          <Button variant="danger" onClick={reload}>Reintentar</Button>
        </div>
      )}

      {/* Tabla de usuarios */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-background text-xs text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">NOMBRE</th>
              <th className="px-4 py-3 font-medium">CORREO</th>
              <th className="px-4 py-3 font-medium">ROL</th>
              <th className="px-4 py-3 font-medium">ESTADO</th>
              <th className="px-4 py-3 text-right font-medium">VENTAS</th>
              <th className="px-4 py-3 font-medium">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">Cargando usuarios...</td>
              </tr>
            )}
            {!loading && !error && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">No se encontraron usuarios.</td>
              </tr>
            )}
            {!loading &&
              users.map((u) => {
                const isSelf = u.id === currentUser?.id
                return (
                  // Las filas inactivas se ven con menos opacidad
                  <tr key={u.id} className={`border-t border-border ${u.activo ? '' : 'opacity-50'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-dark text-xs font-semibold text-white">
                          {getInitials(u.name)}
                        </span>
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.rol === 'admin' ? (
                        <span className="inline-flex rounded-full bg-dark px-2.5 py-1 text-xs font-medium text-white">Administrador</span>
                      ) : (
                        <StatusPill status="success">Cajero</StatusPill>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={u.activo ? 'success' : 'neutral'}>{u.activo ? 'Activo' : 'Inactivo'}</StatusPill>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{u.ventas_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(u)} className="text-text-secondary hover:text-dark" aria-label="Editar">
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          disabled={togglingId === u.id || isSelf}
                          title={isSelf ? 'No puedes desactivar tu propia cuenta' : u.activo ? 'Desactivar' : 'Activar'}
                          className="text-danger disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Activar o desactivar"
                        >
                          <Power size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {/* Modal de crear / editar */}
      <Modal
        open={modalOpen}
        title={editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
        subtitle="Los campos con * son obligatorios"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            {/* Mientras se guarda, el boton se deshabilita para evitar enviar dos veces */}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar Usuario'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm font-medium">
          {formError && (
            <div className="rounded-lg border border-danger bg-danger-bg px-4 py-3 font-normal text-danger-text">
              {formError}
            </div>
          )}
          <label className="block">
            Nombre *
            <input className={inputClass} value={form.name} onChange={(e) => updateField('name', e.target.value)} />
            {fieldErrors.name?.[0] && <p className={fieldErrorClass}>{fieldErrors.name[0]}</p>}
          </label>
          <label className="block">
            Correo *
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
            {fieldErrors.email?.[0] && <p className={fieldErrorClass}>{fieldErrors.email[0]}</p>}
          </label>
          <label className="block">
            Rol *
            <select className={inputClass} value={form.rol} onChange={(e) => updateField('rol', e.target.value)}>
              <option value="cajero">Cajero</option>
              <option value="admin">Administrador</option>
            </select>
            {fieldErrors.rol?.[0] && <p className={fieldErrorClass}>{fieldErrors.rol[0]}</p>}
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              Contraseña {editingId ? '' : '*'}
              <div className="relative">
                {/* El tipo del input cambia entre "password" y "text" segun el ojo */}
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`${inputClass} pr-10`}
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute top-3.5 right-3 text-text-secondary hover:text-dark"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password?.[0] && <p className={fieldErrorClass}>{fieldErrors.password[0]}</p>}
            </label>
            <label className="block">
              Confirmar contraseña {editingId ? '' : '*'}
              <input
                type={showPassword ? 'text' : 'password'}
                className={inputClass}
                value={form.password_confirmation}
                onChange={(e) => updateField('password_confirmation', e.target.value)}
              />
            </label>
          </div>
          <p className="text-xs font-normal text-text-secondary">
            {editingId
              ? 'Déjala vacía para no cambiarla. Si la cambias, se cerrará su sesión en todos sus dispositivos.'
              : 'Mínimo 8 caracteres.'}
          </p>
        </div>
      </Modal>
    </div>
  )
}
