"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const TABLES: Array<{ key: string; label: string }> = [
  { key: "habits", label: "Habits" },
  { key: "habit_logs", label: "Habit logs" },
  { key: "study_sessions", label: "Study sessions" },
  { key: "tasks", label: "Tasks" },
  { key: "days", label: "Sleep, mood & notes" },
  { key: "goals", label: "Goals" },
  { key: "milestones", label: "Milestones" },
  { key: "subjects", label: "Subjects" },
  { key: "topics", label: "Topics" },
  { key: "revisions", label: "Revisions" },
];

export function ExportPanel() {
  const [sensitive, setSensitive] = useState(false);
  const q = `includeSensitive=${sensitive ? 1 : 0}`;
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-3 text-[13.5px]">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--dusk)]" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} />
        <span>
          <span className="font-semibold">Include sensitive habits</span>
          <span className="block text-muted">Off by default, so a file you share doesn’t reveal habits you marked sensitive.</span>
        </span>
      </label>
      <div>
        <a href={`/api/export?format=json&${q}`} download className={buttonClass("primary", "sm")}>
          <Icon name="download" size={16} /> Everything (JSON)
        </a>
      </div>
      <div>
        <p className="mb-2 text-[13px] font-semibold">Spreadsheets (CSV, one file per table)</p>
        <ul className="flex flex-wrap gap-2">
          {TABLES.map((t) => (
            <li key={t.key}>
              <a href={`/api/export?format=csv&table=${t.key}&${q}`} download className={buttonClass("secondary", "sm")}>
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
