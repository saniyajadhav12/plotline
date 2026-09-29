import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="px-8 py-6 sm:px-16">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-2xl text-ink"
        >
          Plotline
        </Link>
      </header>

      <main className="flex-1 flex items-center px-8 sm:px-16">
        <div className="w-full max-w-sm">
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-ink mb-2">
            {title}
          </h1>
          <p className="text-silver mb-8">{subtitle}</p>

          {children}

          <div className="mt-8 text-sm text-silver">{footer}</div>
        </div>
      </main>
    </div>
  );
}
