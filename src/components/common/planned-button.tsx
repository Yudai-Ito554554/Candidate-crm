import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

export function PlannedButton({
  onClick,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          window.alert("この機能は次のPhaseで実装予定です");
        }
      }}
      {...props}
    />
  );
}
