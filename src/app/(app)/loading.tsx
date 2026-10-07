import { CardSkeleton, Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-10 w-80" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}
