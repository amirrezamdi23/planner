export default function Switch({
  checked,
  onChange,
  title,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={'switch' + (checked ? ' checked' : '')}
      onClick={() => onChange(!checked)}
      title={title}
    >
      <span className="switch-thumb" />
    </button>
  );
}
