import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Punto de entrada: monta el componente App dentro del <div id="root">
//
// BrowserRouter activa el enrutamiento de toda la aplicacion. Usa la barra de direcciones
// del navegador (History API): cada pantalla tiene su propia URL, el boton "atras" y
// "adelante" funcionan, y se puede recargar o compartir un enlace directo a una pagina.
// Debe envolver a App porque useNavigate, useLocation, Link, NavLink y Routes
// solo funcionan dentro de un router.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
