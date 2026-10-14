const COLORS = ["#C4472B", "#2B3A42", "#B9975B", "#8C8780"];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function Avatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const bgColor = colorForName(name);

  return (
    <div
      className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: bgColor }}
    >
      <span className="font-[family-name:var(--font-display)] text-2xl text-paper">
        {initial}
      </span>
    </div>
  );
}
