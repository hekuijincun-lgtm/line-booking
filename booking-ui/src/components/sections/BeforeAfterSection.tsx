
type BeforeAfterBlock = {
  label?: string;
  description?: string;
  bullets?: string[];
};

export type BeforeAfterSectionModel = {
  id?: string;
  title?: string;
  subtitle?: string;
  style?: string;
  before?: BeforeAfterBlock;
  after?: BeforeAfterBlock;
};

type BeforeAfterSectionProps = {
  section: BeforeAfterSectionModel;
};

export function BeforeAfterSection({ section }: BeforeAfterSectionProps) {
  const { title, subtitle, style, before, after } = section;

  const styleValue = (style ?? "").toLowerCase();
  const isLuxePink =
    styleValue.includes("pink") || styleValue.includes("luxe");

  const frameClass = isLuxePink
    ? "bg-gradient-to-b from-pink-50/80 via-white to-rose-50/80 border-pink-200/80"
    : "bg-white border-slate-200/80";

  const badgeBeforeClass = isLuxePink
    ? "bg-pink-100 text-pink-700"
    : "bg-slate-100 text-slate-700";

  return (
    <section
      id={section.id ?? "before-after"}
      className="relative py-16 sm:py-20 px-4 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-5xl">
        {title && (
          <h2 className="text-center text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
        )}

        {subtitle && (
          <p className="mt-3 text-center text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
            {subtitle}
          </p>
        )}

        <div className="mt-10 grid gap-6 sm:gap-8 md:grid-cols-2">
          {/* BEFORE カード */}
          {before && (
            <article
              className={`rounded-2xl border ${frameClass} shadow-sm/50 shadow-sm p-6 sm:p-7 flex flex-col gap-3`}
            >
              <span
                className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${badgeBeforeClass}`}
              >
                BEFORE
              </span>
              {before.label && (
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  {before.label}
                </h3>
              )}
              {before.description && (
                <p className="mt-1 text-sm text-slate-600">
                  {before.description}
                </p>
              )}
              {before.bullets && before.bullets.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm text-slate-600 list-disc list-inside">
                  {before.bullets.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}
            </article>
          )}

          {/* AFTER カード */}
          {after && (
            <article
              className={`rounded-2xl border ${frameClass} shadow-sm/50 shadow-md p-6 sm:p-7 flex flex-col gap-3`}
            >
              <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-200/80">
                AFTER
              </span>
              {after.label && (
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  {after.label}
                </h3>
              )}
              {after.description && (
                <p className="mt-1 text-sm text-slate-600">
                  {after.description}
                </p>
              )}
              {after.bullets && after.bullets.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm text-slate-600 list-disc list-inside">
                  {after.bullets.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
