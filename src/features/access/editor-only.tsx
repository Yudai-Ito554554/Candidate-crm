import type { ReactNode } from "react";

import { useAccess } from "@/features/access/use-access";

export function EditorOnly({ children }: { children: ReactNode }) {
  const { canWrite } = useAccess();
  return canWrite ? children : null;
}
