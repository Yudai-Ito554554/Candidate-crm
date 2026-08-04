import type { ReactNode } from "react";

interface PageIntroProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function PageIntro({ title, description, action }: PageIntroProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}
