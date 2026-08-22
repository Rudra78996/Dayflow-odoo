"use client";

import { useEffect } from "react";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="grid min-h-[70svh] place-items-center p-6"><Empty className="max-w-xl border"><EmptyHeader><EmptyMedia variant="icon"><AlertTriangleIcon /></EmptyMedia><EmptyTitle>This workspace hit an unexpected error</EmptyTitle><EmptyDescription>Your session is safe. Retry the route; if the problem continues, share the request time with an administrator.</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={reset}>Try again</Button></EmptyContent></Empty></main>;
}
