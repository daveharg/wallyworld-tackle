import Link from "next/link";

export default function Breadcrumbs({
  trail,
}: {
  trail: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-pine/45">
      <ol className="flex flex-wrap items-center gap-1.5">
        {trail.map((t, i) => (
          <li key={t.label} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-pine/25">/</span>}
            {t.href ? (
              <Link href={t.href} className="hover:text-signal transition">
                {t.label}
              </Link>
            ) : (
              <span className="text-pine/80 font-medium">{t.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
