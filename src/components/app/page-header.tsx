import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, actions, children }: { eyebrow?: ReactNode; title: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end gap-4 lg:mb-8">
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="label-mono mb-1.5">{eyebrow}</p> : null}
        <h1 className="font-serif text-[38px] leading-[1.05] sm:text-[44px]">{title}</h1>
        {children}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
