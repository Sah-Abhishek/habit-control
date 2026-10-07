"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { startSessionAction } from "@/server/actions/study";

/** Starts a study session (or reopens the one already running) and goes to the timer. */
export function StartSessionButton({
  subjectId,
  topicId,
  label = "Start session",
  variant = "accent",
  size = "md",
  className,
}: {
  subjectId?: string | null;
  topicId?: string | null;
  label?: string;
  variant?: "primary" | "accent" | "secondary" | "ghost";
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      icon="play"
      variant={variant}
      size={size}
      className={className}
      pending={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await startSessionAction({ subjectId: subjectId ?? null, topicId: topicId ?? null });
          if (!res.ok) return toast.error(res.error);
          if (res.data.alreadyRunning) toast.success("You already have a session running — here it is.");
          router.push("/study/session");
        })
      }
    >
      {label}
    </Button>
  );
}
