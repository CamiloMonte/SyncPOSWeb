// Convierte un número a pesos colombianos: 9800 -> "$ 9.800"
// Se usa una expresión regular que pone un punto cada tres cifras.
export function formatCOP(n) {
  const text = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (n < 0 ? '-$ ' : '$ ') + text
}

// Convierte un número en porcentaje con coma decimal: 12.34 -> "12,3%"
export function formatPercent(n, decimals = 1) {
  return n.toFixed(decimals).replace('.', ',') + '%'
}

// Muestra solo la hora de una fecha ISO que envia Laravel ("2026-10-21T14:05:00+00:00").
// toLocaleTimeString usa la zona horaria del navegador; con 'es-CO' queda "02:05 p. m.".
export function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

// La API envia el medio de pago en minuscula ("efectivo"); aqui se pone la primera en mayuscula.
export function formatMethod(method) {
  return method.charAt(0).toUpperCase() + method.slice(1)
}
