export default function Input({ label, ...props }) {
  return (
    <label className="block text-sm w-full">
      {label && <div className="text-slate-700 mb-1">{label}</div>}
      <input className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200" {...props} />
    </label>
  );
}
