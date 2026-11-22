type Props = { label?: string; className?: string };

/** A thin horizontal rule, optionally with a centred small-caps label. */
export function Rule({ label, className = "" }: Props) {
  if (!label) return <hr className={`border-0 border-t border-rule ${className}`} />;
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <span className="h-px flex-1 bg-rule" />
      <span className="label">{label}</span>
      <span className="h-px flex-1 bg-rule" />
    </div>
  );
}
