import type { ReactNode } from "react";

interface DefinitionItem {
  label: string;
  value: ReactNode;
  wide?: boolean;
}

export function DefinitionGrid({ items }: { items: DefinitionItem[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div
          className={item.wide ? "md:col-span-2 xl:col-span-3" : ""}
          key={item.label}
        >
          <dt className="text-xs font-medium text-slate-500">{item.label}</dt>
          <dd className="mt-1 text-sm leading-6 text-slate-900">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
