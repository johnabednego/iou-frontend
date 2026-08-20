export default function Card({ title, action, children, className = '' }) {
  return (
    <div className={`bg-white/80 backdrop-blur-md rounded-xl p-6 shadow-soft-lg border border-white/30 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h3 className="text-brand-900 text-lg font-semibold">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
