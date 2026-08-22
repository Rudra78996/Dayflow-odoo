import Link from "next/link";
import { cn } from "@/lib/utils";

export function DayflowMark({ className, label = "Dayflow", href = "/employees" }: { className?: string; label?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", className)}
      aria-label="Dayflow home"
    >
      <span className="grid size-8 grid-cols-2 gap-0.5 rounded-lg bg-primary p-1.5 shadow-sm">
        <span className="rounded-sm bg-primary-foreground/95" />
        <span className="rounded-sm bg-primary-foreground/45" />
        <span className="rounded-sm bg-primary-foreground/45" />
        <span className="rounded-sm bg-primary-foreground/95" />
      </span>
      <span className="max-w-40 truncate text-lg">{label}</span>
    </Link>
  );
}
