"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return setError("Name can’t be empty.");
    if (trimmed.length > 80) return setError("Keep it under 80 characters.");
    setPending(true);
    setError(undefined);
    try {
      const res = await authClient.updateUser({ name: trimmed });
      if (res.error) return setError("We couldn’t update your name. Please try again.");
      toast.success("Name updated");
      router.refresh();
    } catch {
      setError("Can’t reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextField label="Name" value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} autoComplete="name" error={error} />
      <TextField label="Email" value={email} readOnly disabled hint="Email can’t be changed yet." />
      <div>
        <Button type="submit" size="sm" pending={pending} disabled={value.trim() === name}>
          Save name
        </Button>
      </div>
    </form>
  );
}
