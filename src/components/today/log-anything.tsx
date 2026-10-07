"use client";

import { useState } from "react";
import { HabitLogControl, type LoggableHabit } from "@/components/habits/habit-log-control";
import { StartSessionButton } from "@/components/study/start-session-button";
import { AddTaskButton } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import type { TaskPickerOptions } from "@/server/services/tasks";

/** Every common log within one or two taps. */
export function LogAnything({ habits, taskOptions, focusTopicId }: { habits: Array<{ habit: LoggableHabit; value: number }>; taskOptions: TaskPickerOptions; focusTopicId: string | null }) {
  const [open, setOpen] = useState(false);

  function goTo(id: string) {
    setOpen(false);
    // Wait for the dialog to close before moving focus into the page.
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("button, input, textarea")?.focus({ preventScroll: true });
    });
  }

  return (
    <>
      <Button icon="plus" onClick={() => setOpen(true)} aria-keyshortcuts="L">
        Log anything
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Log something" width={560}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <StartSessionButton topicId={focusTopicId} label="Start study session" variant="primary" />
            <AddTaskButton options={taskOptions} variant="secondary" size="md" />
            <Button variant="secondary" icon="smile" onClick={() => goTo("check-in")}>
              Mood & energy
            </Button>
            <Button variant="secondary" icon="moon" onClick={() => goTo("check-in")}>
              Sleep
            </Button>
            <Button variant="secondary" icon="edit" onClick={() => goTo("check-in")}>
              Note
            </Button>
          </div>
          <section>
            <h3 className="label-mono mb-1">Habits today</h3>
            {habits.length ? (
              <ul className="divide-y divide-hair">
                {habits.map(({ habit, value }) => (
                  <li key={habit.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{habit.name}</span>
                    <HabitLogControl habit={habit} value={value} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-[13.5px] text-muted">
                <Icon name="habits" size={16} /> No habits scheduled today.
              </p>
            )}
          </section>
        </div>
      </Dialog>
    </>
  );
}
