import Link from "next/link";
import Image from "next/image";

type MovieCardProps = {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  recommendationId?: string;
};

export function MovieCard({ id, title, year, poster_url, recommendationId }: MovieCardProps) {
  const href = recommendationId ? `/movies/${id}?rec=${recommendationId}` : `/movies/${id}`;

  return (
    <Link href={href} className="group block flex-shrink-0 w-[150px]">
      <div className="relative aspect-[2/3] overflow-hidden bg-film transition-transform duration-200 group-hover:-translate-y-1">
        {poster_url ? (
          <Image
            src={poster_url}
            alt={title}
            fill
            sizes="150px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-paper text-xs p-2 text-center">
            {title}
          </div>
        )}
      </div>
      <p className="mt-2 text-sm text-ink leading-snug line-clamp-2">
        {title}
      </p>
      {year && <p className="text-xs text-silver">{year}</p>}
    </Link>
  );
}
