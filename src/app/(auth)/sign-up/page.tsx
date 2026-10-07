import type { Metadata } from "next";
import { AuthForm } from "@/components/app/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { deleted } = await searchParams;
  return (
    <>
      {deleted === "1" ? (
        <p role="status" className="mb-6 rounded-xl bg-moss-soft px-3.5 py-2.5 text-[13.5px] text-moss">
          Your account and all of its data were deleted.
        </p>
      ) : null}
      <AuthForm mode="sign-up" />
    </>
  );
}
