import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <EmptyState
      className="max-w-lg"
      title="We couldn’t find that"
      body="It may have been deleted, or the link is wrong."
      action={
        <Link href="/" className={buttonClass("secondary", "sm")}>
          Back to Today
        </Link>
      }
    />
  );
}
