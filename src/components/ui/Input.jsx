export default function Input({ label, ...props }) {
  // Render trailing " *" as a red asterisk for required fields
  const renderLabel = (lbl) => {
    if (typeof lbl === 'string' && lbl.endsWith(' *')) {
      return <>{lbl.slice(0, -2)} <span className="text-red-500">*</span></>;
    }
    return lbl;
  };

  return (
    <label className="block text-sm w-full">
      {label && <div className="text-slate-700 mb-1">{renderLabel(label)}</div>}
      <input className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200" {...props} />
    </label>
  );
}
