"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The digest links this to the server log entry without exposing details.
    console.error("Page failed to render", error.digest ?? error.message);
  }, [error]);
  return (
    <ErrorState
      className="max-w-lg"
      title="This page couldn’t load"
      body={
        <>
          Your saved data is safe. This is usually a temporary connection problem.
          {error.digest ? <span className="mt-1 block font-mono text-[11px] text-faint">Reference: {error.digest}</span> : null}
        </>
      }
      action={
        <Button variant="secondary" size="sm" icon="refresh" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
