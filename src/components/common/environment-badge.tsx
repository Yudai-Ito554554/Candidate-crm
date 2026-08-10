import type { AppEnvironment } from "@/lib/env";
import { cn } from "@/lib/utils";

type EnvironmentBadgeProps = {
  className?: string;
  environmentName: AppEnvironment["VITE_APP_ENV"];
};

export function EnvironmentBadge({
  className,
  environmentName,
}: EnvironmentBadgeProps) {
  if (environmentName !== "staging") return null;

  return (
    <span
      aria-label="ステージング環境"
      className={cn(
        "inline-flex shrink-0 items-center rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold tracking-[0.14em] text-amber-950",
        className,
      )}
    >
      STAGING
    </span>
  );
}
