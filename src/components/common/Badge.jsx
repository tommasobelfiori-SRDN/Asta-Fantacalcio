export default function Badge({ className = '', children, title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold ${className}`}
    >
      {children}
    </span>
  )
}
