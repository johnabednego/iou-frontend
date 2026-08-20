export default function Button({ children, onClick, variant = 'primary', className = '' }) {
  const base = 'px-4 py-2 rounded-lg font-semibold transition';
  if (variant === 'primary') {
    return <button onClick={onClick} className={`${base} bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-md ${className}`}>{children}</button>;
  }
  return <button onClick={onClick} className={`${base} bg-white/90 text-slate-700 ${className}`}>{children}</button>;
}
