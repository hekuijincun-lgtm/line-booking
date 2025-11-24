import React from "react";

type BookingCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export const BookingCard: React.FC<BookingCardProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <section className="rounded-3xl bg-kb-surface p-5 shadow-kb-soft md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-kb-navy md:text-lg">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-xs text-kb-textMuted md:text-sm">
              {description}
            </p>
          )}
        </div>
        <div className="hidden items-center gap-1 rounded-full border border-kb-border px-3 py-1 text-[11px] text-kb-textMuted md:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>空きあり</span>
        </div>
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  );
};


