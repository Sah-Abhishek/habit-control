"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, TextField } from "@/components/ui/field";
import { deleteAccountAction } from "@/server/actions/account";

export function DeleteAccount({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const matches = confirmEmail.trim().toLowerCase() === email.toLowerCase();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!matches || !password) return;
    startTransition(async () => {
      const res = await deleteAccountAction({ email: confirmEmail, password });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      router.replace("/sign-up?deleted=1");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="danger" size="sm" icon="trash" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete your account?"
        description="This permanently deletes your account and everything in it — goals, study history, habits, check-ins and notes. It can’t be undone. Consider exporting first."
      >
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormError message={formError} />
          <TextField label={`Type your email (${email}) to confirm`} value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} autoComplete="off" error={errors.email} />
          <TextField label="Current password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" error={errors.password} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep my account
            </Button>
            <Button type="submit" variant="danger" pending={pending} disabled={!matches || !password}>
              Delete forever
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
