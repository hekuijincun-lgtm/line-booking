import React from "react";

type PrimaryButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  fullWidth?: boolean;
};

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  fullWidth = false,
  className = "",
  ...props
}) => {
  return (
    <button
      className={
        "inline-flex items-center justify-center rounded-2xl bg-kb-navy px-4 py-3 text-sm font-semibold text-white shadow-kb-subtle transition hover:bg-kb-navySoft hover:shadow-kb-soft focus:outline-none focus:ring-2 focus:ring-kb-gold focus:ring-offset-2 focus:ring-offset-kb-surface " +
        (fullWidth ? "w-full " : "") +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
};
