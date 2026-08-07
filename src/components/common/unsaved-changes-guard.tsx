import { useCallback, type RefObject } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function UnsavedChangesGuard({
  bypassRef,
  when,
}: {
  bypassRef: RefObject<boolean>;
  when: boolean;
}) {
  const blocker = useBlocker(
    useCallback(() => when && !bypassRef.current, [bypassRef, when]),
  );

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!when || bypassRef.current) return;
        event.preventDefault();
        event.returnValue = "";
      },
      [bypassRef, when],
    ),
  );

  if (blocker.state !== "blocked") return null;

  return (
    <div
      aria-labelledby="unsaved-changes-title"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-4"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <h2
          className="text-base font-semibold text-slate-950"
          id="unsaved-changes-title"
        >
          入力途中の内容があります
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          この画面を離れると、まだ保存していない変更は失われます。
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            onClick={() => blocker.reset()}
            type="button"
            variant="outline"
          >
            編集を続ける
          </Button>
          <Button onClick={() => blocker.proceed()} type="button">
            保存せず移動
          </Button>
        </div>
      </div>
    </div>
  );
}
