"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOutIcon, UserRoundIcon } from "lucide-react";
import { apiFetch, type CurrentAccount } from "@/lib/api";
import { DayflowMark } from "@/components/dayflow-mark";
import { NavAttendanceControl } from "@/components/hr/nav-attendance-control";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PrimaryLink = {
  href: string;
  label: string;
  active: (pathname: string) => boolean;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentAccount | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    apiFetch<CurrentAccount>("/auth/me")
      .then(setUser)
      .catch(() => router.replace("/sign-in"))
      .finally(() => setChecking(false));
  }, [router]);

  async function signOut() {
    await apiFetch("/auth/sign-out", { method: "POST" }).catch(() => undefined);
    router.replace("/sign-in");
    router.refresh();
  }

  if (checking || !user) {
    return (
      <main className="grid min-h-svh place-items-center bg-background p-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          <DayflowMark />
          <Skeleton className="h-2 w-32" />
          <span className="sr-only">Checking your session</span>
        </div>
      </main>
    );
  }

  const roleCodes = user.roles.map(({ role }) => role.code);
  const canOperatePeople =
    roleCodes.includes("ADMIN") || roleCodes.includes("HR_OFFICER");
  const links: PrimaryLink[] = [
    {
      href: "/employees",
      label: "Employees",
      active: (value) => value.startsWith("/employees") || value === "/me",
    },
    {
      href: canOperatePeople ? "/attendance/team" : "/attendance",
      label: "Attendance",
      active: (value) => value.startsWith("/attendance"),
    },
    {
      href: canOperatePeople ? "/time-off/requests" : "/time-off",
      label: "Time Off",
      active: (value) => value.startsWith("/time-off"),
    },
  ];
  const initials = user.employee
    ? `${user.employee.firstName[0] ?? ""}${user.employee.lastName[0] ?? ""}`.toUpperCase()
    : roleCodes.includes("ADMIN")
      ? "AD"
      : "ME";
  const displayName =
    user.employee?.preferredName ||
    user.employee?.firstName ||
    user.organization.displayName;

  return (
    <div className="min-h-svh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b bg-background/94 backdrop-blur-md">
        <div className="mx-auto grid min-h-16 max-w-7xl grid-cols-[1fr_auto] items-center gap-x-4 px-4 sm:grid-cols-[auto_1fr_auto] sm:px-6 lg:px-8">
          <DayflowMark
            label={user.organization.displayName}
            className="[&>span:last-child]:hidden md:[&>span:last-child]:block"
          />
          <nav
            aria-label="Primary navigation"
            className="order-3 col-span-2 flex min-w-0 overflow-x-auto sm:order-none sm:col-span-1 sm:ml-5"
          >
            {links.map((link) => {
              const active = link.active(pathname);
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative shrink-0 px-4 py-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    active &&
                      "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-1.5">
            {user.employee?.id ? <NavAttendanceControl /> : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Open account menu"
                  />
                }
              >
                <Avatar size="sm">
                  <AvatarFallback className="bg-accent text-accent-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <span className="block truncate text-foreground">
                      {displayName}
                    </span>
                    <span className="mt-0.5 block truncate font-normal">
                      {user.roles.map(({ role }) => role.name).join(" · ")}
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push("/me")}>
                    <UserRoundIcon />
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => void signOut()}
                  >
                    <LogOutIcon />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <div
        id="main-content"
        className="mx-auto min-h-[calc(100svh-4rem)] w-full max-w-7xl"
      >
        {children}
      </div>
    </div>
  );
}
