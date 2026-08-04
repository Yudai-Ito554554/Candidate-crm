import { Inbox } from "lucide-react";

export function EmptyState({ message = "該当するデータがありません" }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
      <Inbox aria-hidden="true" className="size-6 text-slate-400" />
      <p>{message}</p>
    </div>
  );
}
