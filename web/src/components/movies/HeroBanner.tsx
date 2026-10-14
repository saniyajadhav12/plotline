import Link from "next/link";
import Image from "next/image";

type HeroBannerProps = {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  description?: string | null;
  genres?: string[] | null;
  eyebrow: string;
  recommendationId?: string;
};

export function HeroBanner({
  id,
  title,
  year,
  poster_url,
  description,
  genres,
  eyebrow,
  recommendationId,
}: HeroBannerProps) {
  const href = recommendationId ? `/movies/${id}?rec=${recommendationId}` : `/movies/${id}`;

  return (
    <section className="mb-14 relative overflow-hidden bg-film">
      <div className="absolute inset-0">
        {poster_url && (
          <Image
            src={poster_url}
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-25"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-film via-film/80 to-film/40" />
      </div>

      <div className="relative px-8 sm:px-16 py-12 sm:py-16 flex flex-col sm:flex-row items-start sm:items-end gap-8">
        {poster_url && (
          <div className="hidden sm:block w-[160px] aspect-[2/3] relative flex-shrink-0 shadow-lg">
            <Image
              src={poster_url}
              alt={title}
              fill
              sizes="160px"
              className="object-cover"
            />
          </div>
        )}

        <div className="flex-1">
          <p className="text-gold text-xs tracking-wide uppercase mb-3">{eyebrow}</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl text-paper mb-2">
            {title}
          </h1>
          <p className="text-paper/70 text-sm mb-4">
            {year}
            {genres && genres.length > 0 && <> · {genres.slice(0, 3).join(", ")}</>}
          </p>
          {description && (
            <p className="text-paper/80 text-sm max-w-xl mb-6 line-clamp-3">
              {description}
            </p>
          )}
          <Link
            href={href}
            className="inline-block bg-marquee text-paper px-5 py-2.5 text-sm font-medium hover:bg-marquee/90 transition-colors"
          >
            View Details
          </Link>
        </div>
      </div>
    </section>
  );
}
