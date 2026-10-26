// Botón reutilizable con variantes de color.
const variants = {
  primary: 'bg-sena text-white hover:bg-sena-hover',
  secondary: 'border border-border bg-surface text-dark hover:bg-background',
  ghost: 'text-text-secondary hover:bg-background',
  danger: 'bg-danger text-white hover:bg-danger-text',
}

// "...rest" recoge el resto de props (onClick, disabled, className, type...)
export default function Button({ variant = 'primary', icon: Icon, children, className = '', ...rest }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  )
}
