"use client";

import { useOffline } from "next/offline";
import { Icon } from "@/components/ui/icon";

export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div role="status" className="flex items-center gap-2.5 bg-inverse px-4 py-2.5 text-[13px] text-inverse-ink">
      <Icon name="cloudOff" size={16} />
      You’re offline. Changes you make will retry automatically when the connection returns — keep this tab open.
    </div>
  );
}
