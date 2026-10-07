"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { formatTimer } from "@/domain/format";
import { METHOD_LABELS, type StudyMethod } from "@/domain/study";
import { deleteSessionAction, finishSessionAction, pauseSessionAction, resumeSessionAction, tallySessionAction } from "@/server/actions/study";
import { useElapsed } from "./use-elapsed";

const BLOCK_SECONDS = 50 * 60;

export type FocusSessionProps = {
  id: string;
  startedAt: string;
  pausedAt: string | null;
  pausedSeconds: number;
  serverNow: string;
  subjectName: string | null;
  topicName: string | null;
  method: StudyMethod | null;
  attempted: number;
  correct: number;
};

/** The running-session screen. Display ticks locally; all stored values come from the server. */
export function FocusSession(props: FocusSessionProps) {
  const router = useRouter();
  const toast = useToast();
  const seconds = useElapsed(props);
  const [tally, setTally] = useState({ attempted: props.attempted, correct: props.correct });
  const [pending, startTransition] = useTransition();
  const [discarding, setDiscarding] = useState(false);
  // Only the newest tally response may overwrite local counts (rapid taps).
  const latest = useRef(0);
  const paused = !!props.pausedAt;

  // Keep the tab title useful while studying in another window.
  useEffect(() => {
    const prev = document.title;
    document.title = `${paused ? "Paused" : formatTimer(seconds)} · ${props.topicName ?? props.subjectName ?? "Study"}`;
    return () => {
      document.title = prev;
    };
  }, [seconds, paused, props.topicName, props.subjectName]);

  function count(result: "correct" | "missed" | "undo-correct" | "undo-missed") {
    const prev = tally;
    const next =
      result === "correct"
        ? { attempted: prev.attempted + 1, correct: prev.correct + 1 }
        : result === "missed"
          ? { attempted: prev.attempted + 1, correct: prev.correct }
          : result === "undo-correct"
            ? prev.correct > 0
              ? { attempted: prev.attempted - 1, correct: prev.correct - 1 }
              : prev
            : prev.attempted > prev.correct
              ? { attempted: prev.attempted - 1, correct: prev.correct }
              : prev;
    setTally(next);
    const seq = ++latest.current;
    void tallySessionAction({ id: props.id, result }).then((res) => {
      if (!res.ok) {
        toast.error(res.error);
        if (seq === latest.current) setTally(prev);
      } else if (seq === latest.current) setTally(res.data);
    });
  }

  function control(action: "pause" | "resume" | "finish") {
    startTransition(async () => {
      const res =
        action === "pause" ? await pauseSessionAction({ id: props.id }) : action === "resume" ? await resumeSessionAction({ id: props.id }) : await finishSessionAction({ id: props.id });
      if (!res.ok) return void toast.error(res.error);
      if (action === "finish") router.push(`/study/sessions/${props.id}?finished=1`);
      else router.refresh();
    });
  }

  const blockProgress = (seconds % BLOCK_SECONDS) / BLOCK_SECONDS;
  const blockNo = Math.floor(seconds / BLOCK_SECONDS) + 1;
  const R = 120;
  const C = 2 * Math.PI * R;
  const missed = tally.attempted - tally.correct;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 rounded-[28px] bg-inverse px-6 py-8 text-inverse-ink">
      <div className="flex w-full items-center gap-2">
        <Icon name="book" size={16} className="text-ochre" />
        <p className="min-w-0 flex-1 truncate text-[14px] font-semibold">{[props.subjectName, props.topicName].filter(Boolean).join(" · ") || "Untitled session"}</p>
        {props.method ? <span className="rounded-full bg-inverse-ink/10 px-2.5 py-1 text-[11.5px]">{METHOD_LABELS[props.method]}</span> : null}
      </div>

      <div className="relative grid size-[260px] place-items-center">
        <svg viewBox="0 0 260 260" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="130" cy="130" r={R} fill="none" stroke="currentColor" strokeOpacity={0.14} strokeWidth={8} />
          <circle cx="130" cy="130" r={R} fill="none" stroke="var(--ochre)" strokeWidth={8} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - blockProgress)} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
        </svg>
        <div className="flex flex-col items-center">
          <span className="label-mono !text-inverse-ink/70">{paused ? "Paused" : "Elapsed"}</span>
          <span className="font-serif text-[72px] leading-none tabular-nums" role="timer" aria-live="off">
            {formatTimer(seconds)}
          </span>
          <span className="text-[13px] opacity-60">50-min block {blockNo}</span>
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-3">
        <div className="flex flex-col items-center gap-2 rounded-[20px] border border-inverse-ink/15 bg-inverse-ink/5 p-4">
          <button type="button" onClick={() => count("correct")} aria-label="Got one right" className="grid size-12 place-items-center rounded-full bg-moss text-moss-on active:scale-95">
            <Icon name="check" size={22} />
          </button>
          <span className="font-mono text-[22px]" aria-live="polite">
            {tally.correct}
          </span>
          <span className="text-[12px] opacity-60">Got it right</span>
          <button type="button" disabled={tally.correct === 0} onClick={() => count("undo-correct")} className="text-[11.5px] underline opacity-50 disabled:invisible">
            undo
          </button>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-[20px] border border-inverse-ink/15 bg-inverse-ink/5 p-4">
          <button type="button" onClick={() => count("missed")} aria-label="Missed one" className="grid size-12 place-items-center rounded-full bg-clay text-card active:scale-95">
            <Icon name="x" size={22} />
          </button>
          <span className="font-mono text-[22px]" aria-live="polite">
            {missed}
          </span>
          <span className="text-[12px] opacity-60">Missed</span>
          <button type="button" disabled={missed === 0} onClick={() => count("undo-missed")} className="text-[11.5px] underline opacity-50 disabled:invisible">
            undo
          </button>
        </div>
      </div>
      <p className="-mt-2 text-center text-[12px] opacity-50">Tap while you practise — accuracy fills itself in. Counts are saved as you go.</p>

      <div className="grid w-full grid-cols-2 gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => control(paused ? "resume" : "pause")}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-inverse-ink/30 text-[15px] font-semibold disabled:opacity-50"
        >
          <Icon name={paused ? "play" : "pause"} size={18} /> {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" disabled={pending} onClick={() => control("finish")} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-ochre text-[15px] font-semibold text-inverse disabled:opacity-50">
          <Icon name="stop" size={18} /> Finish
        </button>
      </div>
      <button type="button" onClick={() => setDiscarding(true)} className="text-[12.5px] opacity-60 hover:opacity-100">
        Discard this session
      </button>

      <Dialog open={discarding} onClose={() => setDiscarding(false)} title="Discard this session?" description="The timer and your ✓/✗ counts are deleted. Use Finish instead to keep the time.">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDiscarding(false)}>
            Keep studying
          </Button>
          <Button
            variant="danger"
            pending={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteSessionAction({ id: props.id });
                if (!res.ok) return void toast.error(res.error);
                toast.success("Session discarded");
                router.replace("/study");
              })
            }
          >
            Discard
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
