import { DayflowMark } from "@/components/dayflow-mark";

export function AuthFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(32rem,0.78fr)]">
      <section className="relative hidden overflow-hidden bg-primary px-12 py-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 top-20 size-80 rounded-full border border-primary-foreground/15" />
        <div className="absolute -right-8 top-36 size-48 rounded-full border border-primary-foreground/15" />
        <DayflowMark className="relative text-primary-foreground" />
        <div className="relative max-w-xl pb-8">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-primary-foreground/65">
            People operations, in rhythm
          </p>
          <blockquote className="text-4xl font-medium leading-[1.08] tracking-[-0.035em] xl:text-5xl">
            Make every workday clear, connected, and quietly efficient.
          </blockquote>
          <div className="mt-10 flex items-center gap-4 text-sm text-primary-foreground/70">
            <span className="h-px w-12 bg-primary-foreground/35" />
            Built for growing teams
          </div>
        </div>
      </section>
      <section className="flex min-h-svh items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <DayflowMark className="mb-14 lg:hidden" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
