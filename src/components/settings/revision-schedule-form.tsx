"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { updateSettingsAction } from "@/server/actions/settings";

const DEFAULT = [1, 3, 7, 21, 45];

function parse(text: string): number[] | string {
  const parts = text.split(/[\s,]+/).filter(Boolean);
  if (!parts.length) return "Add at least one interval.";
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 365)) return "Use whole days between 1 and 365.";
  if (nums.some((n, i) => i > 0 && n <= nums[i - 1])) return "Each interval must be longer than the one before.";
  if (nums.length > 10) return "Use at most 10 intervals.";
  return nums;
}

export function RevisionScheduleForm({ initial }: { initial: number[] }) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState(initial.join(", "));
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const parsed = parse(text);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (typeof parsed === "string") return setError(parsed);
    startTransition(async () => {
      const res = await updateSettingsAction({ revisionScheduleDays: parsed });
      if (!res.ok) return setError(res.fieldErrors?.revisionScheduleDays ?? res.error);
      setError(undefined);
      toast.success("Revision schedule saved");
      router.refresh();
    });
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3">
      <TextField
        label="Revise after (days)"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(undefined);
        }}
        hint="Comma-separated, counted from when you complete a topic. Applies to topics completed from now on."
        error={error}
        inputMode="numeric"
      />
      {typeof parsed !== "string" ? (
        <ol className="flex flex-wrap gap-1.5" aria-label="Preview">
          {parsed.map((d, i) => (
            <li key={i} className="rounded-full bg-ochre-soft px-2.5 py-1 font-mono text-[11.5px] text-ochre">
              Rev {i + 1} · +{d}d
            </li>
          ))}
        </ol>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" pending={pending}>
          Save schedule
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setText(DEFAULT.join(", "))}>
          Reset to 1, 3, 7, 21, 45
        </Button>
      </div>
    </form>
  );
}
