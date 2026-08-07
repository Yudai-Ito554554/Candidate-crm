import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function ConnectivityBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900"
      role="alert"
    >
      <WifiOff aria-hidden="true" className="size-4" />
      オフラインです。表示中の情報は古い可能性があり、追加・変更は接続回復後に実行してください。
    </div>
  );
}
