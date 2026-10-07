"use client";

import { useEffect, useRef, useState } from "react";
import { elapsedSeconds } from "@/domain/study";

export type TimingProps = { startedAt: string; pausedAt: string | null; pausedSeconds: number; serverNow: string };

/**
 * Live elapsed seconds for display only. Corrects for a skewed device clock by
 * anchoring to the server's time at render; the stored duration is always computed
 * on the server when the session finishes.
 */
export function useElapsed({ startedAt, pausedAt, pausedSeconds, serverNow }: TimingProps): number {
  const skew = useRef<number | null>(null);
  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  useEffect(() => {
    skew.current = new Date(serverNow).getTime() - Date.now();
    const tick = () => setNow(Date.now() + (skew.current ?? 0));
    tick();
    if (pausedAt) return;
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [serverNow, pausedAt]);
  return elapsedSeconds(
    { startedAt: new Date(startedAt), endedAt: null, pausedAt: pausedAt ? new Date(pausedAt) : null, pausedSeconds },
    new Date(now),
  );
}
