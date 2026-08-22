import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarCheck2Icon,
  CheckIcon,
  Clock3Icon,
  FileCheck2Icon,
  ShieldCheckIcon,
  UsersRoundIcon,
} from "lucide-react";
import { DayflowMark } from "@/components/dayflow-mark";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "People operations, in rhythm",
  description:
    "Dayflow brings employee records, attendance, time off and payroll preparation into one clear operating system.",
};

const operatingAreas = [
  { icon: UsersRoundIcon, title: "A clear employee record", body: "Keep work details, reporting lines, private information and account access in the right place." },
  { icon: Clock3Icon, title: "Attendance people can trust", body: "Give employees a simple clock, give HR a complete day-wise record, and keep corrections traceable." },
  { icon: CalendarCheck2Icon, title: "Time off without guesswork", body: "Balances, requests, approvals and the annual calendar stay connected for employees and reviewers." },
  { icon: FileCheck2Icon, title: "Payroll-ready inputs", body: "Use approved attendance and leave as the source for payable days, exceptions and payroll review." },
];

const employeeBenefits = [
  "Clock in and see the live work timer from anywhere in the app",
  "Review monthly attendance and request corrections",
  "See leave balances on a full-year calendar",
  "Manage personal details from one profile",
];

const adminBenefits = [
  "Create employee accounts with secure email invitations",
  "Review team attendance and time-off requests",
  "Define schedules, holidays and leave policies",
  "Prepare payroll from validated operational records",
];

export default function Home() {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8">
          <DayflowMark href="/" />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex" aria-label="Primary navigation">
            <Link href="#product" className="transition-colors hover:text-foreground">Product</Link>
            <Link href="#roles" className="transition-colors hover:text-foreground">For your team</Link>
            <Link href="#security" className="transition-colors hover:text-foreground">Security</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" nativeButton={false} render={<Link href="/sign-in" />}>Sign in</Button>
            <Button nativeButton={false} render={<Link href="/sign-up" />}>
              Start with Dayflow
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1.03fr_0.97fr] lg:py-20">
        <div className="max-w-2xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-primary">People operations, in rhythm</p>
          <h1 className="max-w-xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">Make every workday clear.</h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">Dayflow connects employee records, attendance, time off and payroll preparation in one calm workspace.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" nativeButton={false} render={<Link href="/sign-up" />}>
              Create your workspace
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/sign-in" />}>Open your account</Button>
          </div>
        </div>

        <div className="relative lg:pl-6" aria-label="Dayflow connects the daily people operations workflow">
          <div className="absolute -inset-12 -rotate-3 rounded-[2.5rem] bg-primary/5" />
          <div className="relative overflow-hidden rounded-3xl border bg-card shadow-[0_28px_80px_-44px_rgba(75,42,81,0.5)]">
            <div className="flex items-center justify-between border-b px-6 py-5">
              <div>
                <p className="font-semibold">Today at your company</p>
                <p className="mt-1 text-sm text-muted-foreground">One record moves through the whole workday.</p>
              </div>
              <ShieldCheckIcon className="text-primary" aria-hidden="true" />
            </div>
            <div className="grid gap-0 md:grid-cols-[1fr_auto_1fr]">
              <div className="flex flex-col gap-6 p-6 sm:p-8">
                <WorkflowItem icon={Clock3Icon} title="Attendance" body="The workday begins with a secure check-in." />
                <WorkflowItem icon={CalendarCheck2Icon} title="Time off" body="Approved leave updates the same record." />
                <WorkflowItem icon={FileCheck2Icon} title="Payroll input" body="Validated days become reliable payroll inputs." />
              </div>
              <div className="hidden w-px bg-border md:block" />
              <div className="flex min-h-72 flex-col justify-between bg-primary p-7 text-primary-foreground sm:p-8">
                <p className="text-sm font-medium text-primary-foreground/70">A shared source of truth</p>
                <div>
                  <p className="text-4xl font-semibold tracking-[-0.04em]">Less chasing.</p>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">Better records.</p>
                </div>
                <p className="max-w-xs text-sm leading-6 text-primary-foreground/75">Employees see what they need. HR and admins get the control they need.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="product" className="border-y bg-card">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">The workday stays connected from start to finish.</h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">Each module does one job well, while sharing the records the next step depends on.</p>
          </div>
          <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border bg-border lg:grid-cols-2">
            {operatingAreas.map(({ icon: Icon, title, body }, index) => (
              <article key={title} className={index === 0 ? "bg-primary p-8 text-primary-foreground sm:p-10" : "bg-background p-8 sm:p-10"}>
                <Icon className={index === 0 ? "text-primary-foreground" : "text-primary"} aria-hidden="true" />
                <h3 className="mt-16 text-2xl font-semibold tracking-tight">{title}</h3>
                <p className={index === 0 ? "mt-3 max-w-lg leading-7 text-primary-foreground/75" : "mt-3 max-w-lg leading-7 text-muted-foreground"}>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="roles" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
          <div>
            <h2 className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Built around the people doing the work.</h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">The interface changes with responsibility, without splitting your company across different systems.</p>
          </div>
          <div className="grid gap-12 sm:grid-cols-2">
            <RoleList title="For employees" items={employeeBenefits} />
            <RoleList title="For admins and HR" items={adminBenefits} />
          </div>
        </div>
      </section>

      <section id="security" className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:pb-32">
        <div className="grid overflow-hidden rounded-3xl border bg-card lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-secondary p-8 sm:p-12">
            <ShieldCheckIcon className="text-primary" aria-hidden="true" />
            <h2 className="mt-12 text-3xl font-semibold tracking-[-0.035em]">Private by role. Traceable by design.</h2>
          </div>
          <div className="p-8 sm:p-12">
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">Dayflow separates employee, HR and administrator access. Sensitive profile fields stay restricted, authentication tokens are stored as hashes, and important actions create an audit record.</p>
            <Button className="mt-8" variant="outline" nativeButton={false} render={<Link href="/sign-up" />}>
              Set up your company
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-20 sm:px-8 lg:flex-row lg:items-end lg:py-24">
          <div>
            <h2 className="max-w-2xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Give your team a clearer workday.</h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-primary-foreground/70">Create the company workspace, verify your email, and invite your first employee.</p>
          </div>
          <Button size="lg" variant="secondary" nativeButton={false} render={<Link href="/sign-up" />}>
            Start with Dayflow
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </section>

      <footer className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 border-t border-primary-foreground/15 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <DayflowMark href="/" className="text-primary-foreground" />
          <div className="flex gap-6 text-sm text-primary-foreground/70">
            <Link href="/sign-in" className="hover:text-primary-foreground">Sign in</Link>
            <Link href="/sign-up" className="hover:text-primary-foreground">Create workspace</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function WorkflowItem({ icon: Icon, title, body }: { icon: typeof Clock3Icon; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icon aria-hidden="true" /></div>
      <div><p className="font-semibold">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p></div>
    </div>
  );
}

function RoleList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <ul className="mt-6 flex flex-col gap-5">
        {items.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground"><CheckIcon className="mt-1 shrink-0 text-primary" aria-hidden="true" />{item}</li>)}
      </ul>
    </div>
  );
}
