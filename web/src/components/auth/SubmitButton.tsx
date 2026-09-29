export function SubmitButton({
  children,
  loading,
}: {
  children: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-ink text-paper py-2.5 font-medium hover:bg-marquee transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}
