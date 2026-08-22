import { Skeleton } from "@/components/ui/skeleton";

export default function WorkspaceLoading() {
  return <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8" aria-label="Loading workspace"><div className="flex flex-col gap-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-9 w-72 max-w-full" /><Skeleton className="h-4 w-[32rem] max-w-full" /></div><div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><Skeleton className="h-96" /></main>;
}
