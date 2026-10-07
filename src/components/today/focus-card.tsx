"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { StartSessionButton } from "@/components/study/start-session-button";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, SelectField, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { saveFocusAction } from "@/server/actions/days";

export type TopicOption = { id: string; name: string; subjectId: string; subjectName: string };

function FocusDialog({ open, onClose, topics, initialTopicId, initialText }: { open: boolean; onClose: () => void; topics: TopicOption[]; initialTopicId: string | null; initialText: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [topicId, setTopicId] = useState(initialTopicId ?? "");
  const [text, setText] = useState(initialText ?? "");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const subjects = [...new Map(topics.map((t) => [t.subjectId, t.subjectName])).entries()];

  function save(next: { topicId: string | null; text: string | null }, message: string) {
    startTransition(async () => {
      const res = await saveFocusAction(next);
      if (!res.ok) return setError(res.fieldErrors?.text ?? res.error);
      toast.success(message);
      onClose();
      router.refresh();
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!topicId && !text.trim()) return setError("Pick a topic or write what you’ll focus on.");
    save({ topicId: topicId || null, text: text.trim() || null }, "Today’s focus set");
  }

  return (
    <Dialog open={open} onClose={onClose} title="Today’s one thing" description="The single thing that would make today count. Everything else is a bonus.">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={error} />
        {topics.length ? (
          <SelectField label="A topic you’re studying" optional value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">—</option>
            {subjects.map(([sid, sname]) => (
              <optgroup key={sid} label={sname}>
                {topics
                  .filter((t) => t.subjectId === sid)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </SelectField>
        ) : null}
        <TextField
          label={topics.length ? "…or describe it" : "What will you focus on?"}
          optional={topics.length > 0}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={140}
          placeholder="e.g. Serializability + 2 PYQ sets"
          hint={topics.length ? "With a topic, this becomes the detail line." : undefined}
        />
        <div className="flex justify-between gap-2">
          {initialTopicId || initialText ? (
            <Button variant="ghost" onClick={() => save({ topicId: null, text: null }, "Focus cleared")} disabled={pending}>
              Clear focus
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" pending={pending}>
              Set focus
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

export function FocusCard({ title, detail, topicId, subjectId, text, feeds, topics }: { title: string | null; detail: string | null; topicId: string | null; subjectId: string | null; text: string | null; feeds: string | null; topics: TopicOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="focus-title" className="flex flex-col gap-3.5 rounded-[24px] bg-inverse p-6 text-inverse-ink sm:p-[26px]">
      <div className="flex items-center gap-3">
        <span className="label-mono text-inverse-ink">Today’s one thing</span>
        {feeds ? <span className="ml-auto hidden truncate text-[12px] opacity-60 sm:block">Feeds → {feeds}</span> : null}
      </div>
      {title ? (
        <>
          <h2 id="focus-title" className="font-serif text-[34px] leading-[1.05] sm:text-[40px]">
            {title}
          </h2>
          {detail ? <p className="text-[14px] opacity-70">{detail}</p> : null}
          <div className="flex flex-wrap gap-2.5 pt-1">
            <StartSessionButton topicId={topicId} subjectId={subjectId} />
            <button type="button" onClick={() => setOpen(true)} className="h-11 rounded-2xl border border-inverse-ink/30 px-4 text-[15px] font-medium hover:bg-inverse-ink/10">
              Change focus
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 id="focus-title" className="font-serif text-[32px] leading-[1.05]">
            What matters most today?
          </h2>
          <p className="text-[14px] opacity-70">Pick one thing. Starting a session from here links your time to it.</p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button type="button" onClick={() => setOpen(true)} className="h-11 rounded-2xl bg-moss px-4 text-[15px] font-semibold text-moss-on hover:opacity-90">
              Choose focus
            </button>
            <StartSessionButton variant="ghost" label="Just start a session" className="text-inverse-ink hover:bg-inverse-ink/10 hover:text-inverse-ink" />
          </div>
        </>
      )}
      {open ? <FocusDialog open={open} onClose={() => setOpen(false)} topics={topics} initialTopicId={topicId} initialText={text} /> : null}
    </section>
  );
}
