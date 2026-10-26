// Funciones auxiliares para trabajar con fechas en formato "YYYY-MM-DD" (el que espera la API).

// Pone un cero a la izquierda: 5 -> "05"
function pad(n) {
  return String(n).padStart(2, '0')
}

// Convierte un objeto Date en el texto "YYYY-MM-DD" usando la fecha LOCAL del computador.
//
// IMPORTANTE: NO se usa date.toISOString().slice(0, 10). toISOString() siempre devuelve la
// fecha en UTC (hora universal). Colombia esta 5 horas atras de UTC, asi que despues de las
// 7:00 p. m. en Colombia, en UTC ya es el dia siguiente y la API recibiria la fecha de manana.
// Por eso armamos el texto con getFullYear(), getMonth() y getDate(), que son locales.
export function toLocalDateString(date) {
  // getMonth() empieza en 0 (enero = 0), por eso se suma 1
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Convierte "2026-10-15" en un Date a medianoche LOCAL.
// new Date("2026-10-15") interpreta el texto como UTC y en Colombia mostraria el 14 de octubre
// a las 7:00 p. m. Con new Date(anio, mes, dia) los numeros se toman como hora local.
export function parseLocalDate(text) {
  const [year, month, day] = text.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Muestra "2026-10-21" como "21/10/2026". Solo reordena el texto: no crea ningun Date,
// asi que no hay riesgo de que la zona horaria cambie el dia.
export function formatDateShort(text) {
  const [year, month, day] = text.split('-')
  return `${day}/${month}/${year}`
}

// Calcula el rango { desde, hasta } de cada opcion del selector de Reportes.
// Es una funcion "pura": solo usa lo que recibe (la opcion y la fecha de hoy), no lee estado
// ni hace peticiones, por eso es facil de probar y de reutilizar.
export function rangeFor(option, today) {
  const hasta = toLocalDateString(today)

  if (option === 'Día') {
    return { desde: hasta, hasta }
  }

  if (option === 'Semana') {
    // getDay(): domingo = 0, lunes = 1 ... sabado = 6.
    // (dia + 6) % 7 cuenta cuantos dias pasaron desde el lunes (lunes = 0, domingo = 6).
    const daysSinceMonday = (today.getDay() + 6) % 7
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysSinceMonday)
    return { desde: toLocalDateString(monday), hasta }
  }

  // Mes (y valor por defecto): desde el dia 1 del mes actual hasta hoy
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  return { desde: toLocalDateString(firstDay), hasta }
}
