"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  AwardIcon,
  BadgeIndianRupeeIcon,
  Building2Icon,
  CalendarDaysIcon,
  IdCardIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { apiFetch, type CurrentAccount, type EmployeeSummary } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/hr-api";
import { DocumentUpload } from "@/components/employees/document-upload";
import { EmployeeInvitationDialog } from "@/components/employees/employee-invitation";
import {
  EditResumeDialog,
  EditWorkProfileDialog,
} from "@/components/employees/profile-edit-dialogs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type PrivateRecord = {
  dateOfBirth?: string | null;
  nationality?: string | null;
  personalEmail?: string | null;
  personalPhone?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
} | null;
type BankRecord = {
  accountHolderName?: string | null;
  accountNumberMasked?: string | null;
  bankName?: string | null;
  ifscMasked?: string | null;
} | null;
type StatutoryRecord = {
  panMasked?: string | null;
  uanMasked?: string | null;
} | null;
type SalaryAssignment = {
  id: string;
  monthlyWage: number | string;
  workingDaysPerWeek: number | string;
  breakMinutes: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: string;
  structure: {
    id: string;
    code: string;
    name: string;
    version: number;
    components: Array<{
      id: string;
      code: string;
      name: string;
      componentType: string;
      calculationMode: string;
      value: number | string;
    }>;
  };
};

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium">
          {value || "Not provided"}
        </p>
      </div>
    </div>
  );
}

export function EmployeeProfile({ employeeId }: { employeeId: string }) {
  const [profile, setProfile] = useState<EmployeeSummary | null>(null);
  const [error, setError] = useState("");
  const [privateRecord, setPrivateRecord] = useState<PrivateRecord>(null);
  const [bank, setBank] = useState<BankRecord>(null);
  const [statutory, setStatutory] = useState<StatutoryRecord>(null);
  const [protectedLoaded, setProtectedLoaded] = useState(false);
  const [protectedError, setProtectedError] = useState("");
  const [canManageInvitations, setCanManageInvitations] = useState(false);
  const [canViewSalary, setCanViewSalary] = useState(false);
  const [canViewSecurity, setCanViewSecurity] = useState(false);
  const [salaryAssignments, setSalaryAssignments] = useState<
    SalaryAssignment[]
  >([]);
  const [salaryLoaded, setSalaryLoaded] = useState(false);
  const [salaryError, setSalaryError] = useState("");
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  const loadProfile = useCallback(() => {
    apiFetch<EmployeeSummary>(`/employees/${employeeId}`)
      .then(setProfile)
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load profile.",
        ),
      );
  }, [employeeId]);
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);
  useEffect(() => {
    void apiFetch<CurrentAccount>("/auth/me").then((account) => {
      const admin = account.roles.some(({ role }) => role.code === "ADMIN");
      setCanManageInvitations(admin);
      setCanViewSalary(admin);
      setCanViewSecurity(admin || account.employee?.id === employeeId);
      setIsOwnProfile(account.employee?.id === employeeId);
    });
  }, [employeeId]);

  async function loadProtected() {
    if (protectedLoaded) return;
    setProtectedLoaded(true);
    const requests = [
      apiFetch<PrivateRecord>(`/employees/${employeeId}/private-profile`).then(
        setPrivateRecord,
      ),
      apiFetch<BankRecord>(`/employees/${employeeId}/bank-details`).then(
        setBank,
      ),
      apiFetch<StatutoryRecord>(
        `/employees/${employeeId}/statutory-details`,
      ).then(setStatutory),
    ];
    const settled = await Promise.allSettled(requests);
    if (settled.every((item) => item.status === "rejected"))
      setProtectedError(
        "Your role does not permit access to this employee’s protected records.",
      );
  }

  async function loadSalary() {
    if (salaryLoaded || !canViewSalary) return;
    setSalaryLoaded(true);
    try {
      setSalaryAssignments(
        await apiFetch<SalaryAssignment[]>(
          `/salary-assignments?employeeId=${employeeId}`,
        ),
      );
    } catch (cause) {
      setSalaryError(
        cause instanceof Error
          ? cause.message
          : "Could not load salary details.",
      );
    }
  }

  if (error)
    return (
      <div
        role="alert"
        className="m-6 rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"
      >
        {error}
      </div>
    );
  if (!profile)
    return (
      <main className="flex flex-col gap-5 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </main>
    );

  const name =
    profile.preferredName || `${profile.firstName} ${profile.lastName}`;
  const assignment = profile.assignments[0];
  const initials =
    `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase();
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Link
        href="/employees"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "w-fit -ml-2",
        )}
      >
        <ArrowLeftIcon />
        Directory
      </Link>
      <section className="relative overflow-hidden rounded-xl bg-card p-5 ring-1 ring-foreground/10 sm:p-7">
        <div className="absolute right-0 top-0 h-full w-2 bg-primary" />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar className="size-20 text-xl">
            <AvatarFallback className="bg-accent text-accent-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                {name}
              </h1>
              <Badge variant="success">
                {profile.employmentStatus.toLowerCase()}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.jobTitle || "Role not assigned"} ·{" "}
              <span className="tabular">{profile.loginId}</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {profile.workEmail && (
                <span className="flex items-center gap-1.5">
                  <MailIcon className="size-3.5" />
                  {profile.workEmail}
                </span>
              )}
              {profile.workPhone && (
                <span className="flex items-center gap-1.5">
                  <PhoneIcon className="size-3.5" />
                  {profile.workPhone}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageInvitations && profile.user?.status === "INVITED" ? (
              <EmployeeInvitationDialog
                employeeId={profile.id}
                loginId={profile.loginId}
              />
            ) : null}
            {isOwnProfile ? (
              <>
                <EditWorkProfileDialog
                  profile={profile}
                  onUpdated={loadProfile}
                />
                <EditResumeDialog profile={profile} onUpdated={loadProfile} />
              </>
            ) : null}
          </div>
        </div>
        <div className="mt-6 grid gap-5 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Detail
            icon={Building2Icon}
            label="Department"
            value={assignment?.department?.name}
          />
          <Detail
            icon={SparklesIcon}
            label="Manager"
            value={
              assignment?.manager
                ? assignment.manager.preferredName ||
                  `${assignment.manager.firstName} ${assignment.manager.lastName}`
                : undefined
            }
          />
          <Detail
            icon={MapPinIcon}
            label="Work location"
            value={assignment?.location?.name}
          />
          <Detail
            icon={CalendarDaysIcon}
            label="Joined"
            value={new Intl.DateTimeFormat("en-IN", {
              dateStyle: "medium",
            }).format(new Date(profile.dateOfJoining))}
          />
        </div>
      </section>
      <Tabs
        defaultValue="resume"
        onValueChange={(value) => {
          if (value === "private") void loadProtected();
          if (value === "salary") void loadSalary();
        }}
      >
        <TabsList variant="line" className="max-w-full overflow-x-auto">
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="private">
            <LockKeyholeIcon />
            Private info
          </TabsTrigger>
          {canViewSalary ? (
            <TabsTrigger value="salary">
              <BadgeIndianRupeeIcon />
              Salary info
            </TabsTrigger>
          ) : null}
          {canViewSecurity ? (
            <TabsTrigger value="security">
              <KeyRoundIcon />
              Security
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="resume" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardContent className="leading-6 text-muted-foreground">
                  {profile.resume?.about || "No introduction added yet."}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>What I love at work</CardTitle>
                </CardHeader>
                <CardContent className="leading-6 text-muted-foreground">
                  {profile.resume?.jobLove || "Not shared yet."}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Interests and hobbies</CardTitle>
                </CardHeader>
                <CardContent className="leading-6 text-muted-foreground">
                  {profile.resume?.interests || "Not shared yet."}
                </CardContent>
              </Card>
            </div>
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Skills</CardTitle>
                  <CardDescription>
                    Capabilities shared with the team.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {profile.skills.length ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((item) => (
                        <Badge key={item.skill.id} variant="secondary">
                          {item.skill.name}
                          {item.proficiency ? ` · ${item.proficiency}/5` : ""}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No skills added yet.
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AwardIcon className="size-4" />
                    Certifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {profile.certifications.length ? (
                    <div className="flex flex-col gap-3">
                      {profile.certifications.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                        >
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.issuer || "Issuer not provided"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      No certifications added yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="private" className="pt-4">
          <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning-foreground">
            <LockKeyholeIcon className="mr-2 inline size-4" />
            Protected fields are permission-checked, and financial identifiers
            are encrypted and only returned masked.
          </div>
          {protectedError ? (
            <p className="text-sm text-destructive">{protectedError}</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Personal</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Detail
                    icon={CalendarDaysIcon}
                    label="Date of birth"
                    value={
                      privateRecord?.dateOfBirth
                        ? new Date(
                            privateRecord.dateOfBirth,
                          ).toLocaleDateString("en-IN")
                        : undefined
                    }
                  />
                  <Detail
                    icon={MapPinIcon}
                    label="Nationality"
                    value={privateRecord?.nationality}
                  />
                  <Detail
                    icon={MailIcon}
                    label="Personal email"
                    value={privateRecord?.personalEmail}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Bank details</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Detail
                    icon={Building2Icon}
                    label="Bank"
                    value={bank?.bankName}
                  />
                  <Detail
                    icon={IdCardIcon}
                    label="Account"
                    value={bank?.accountNumberMasked}
                  />
                  <Detail
                    icon={ShieldCheckIcon}
                    label="IFSC"
                    value={bank?.ifscMasked}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Statutory</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Detail
                    icon={IdCardIcon}
                    label="PAN"
                    value={statutory?.panMasked}
                  />
                  <Detail
                    icon={IdCardIcon}
                    label="UAN"
                    value={statutory?.uanMasked}
                  />
                </CardContent>
              </Card>
            </div>
          )}
          <div className="mt-4">
            <DocumentUpload employeeId={employeeId} />
          </div>
        </TabsContent>
        {canViewSalary ? (
          <TabsContent value="salary" className="pt-4">
            <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning-foreground">
              <LockKeyholeIcon className="mr-2 inline size-4" />
              Salary information is restricted to Admin accounts and is never
              returned to ordinary employee or HR sessions.
            </div>
            {salaryError ? (
              <p className="text-sm text-destructive">{salaryError}</p>
            ) : !salaryLoaded ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : salaryAssignments.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>No salary assignment</CardTitle>
                  <CardDescription>
                    Assign an effective-dated salary structure before this
                    employee can be included in payroll.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href="/salary-structures"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Open salary structures
                  </Link>
                </CardContent>
              </Card>
            ) : (
              (() => {
                const salary = salaryAssignments[0];
                return (
                  <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                    <Card>
                      <CardHeader>
                        <CardTitle>{salary.structure.name}</CardTitle>
                        <CardDescription>
                          {salary.structure.code} · version{" "}
                          {salary.structure.version}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                        <Detail
                          icon={BadgeIndianRupeeIcon}
                          label="Monthly wage"
                          value={formatMoney(
                            Number(salary.monthlyWage),
                            salary.currency,
                          )}
                        />
                        <Detail
                          icon={BadgeIndianRupeeIcon}
                          label="Yearly wage"
                          value={formatMoney(
                            Number(salary.monthlyWage) * 12,
                            salary.currency,
                          )}
                        />
                        <Detail
                          icon={CalendarDaysIcon}
                          label="Working schedule"
                          value={`${salary.workingDaysPerWeek} days/week · ${salary.breakMinutes} break minutes`}
                        />
                        <Detail
                          icon={CalendarDaysIcon}
                          label="Effective period"
                          value={`${formatDate(salary.effectiveFrom)}${salary.effectiveTo ? ` – ${formatDate(salary.effectiveTo)}` : " onward"}`}
                        />
                        <Detail
                          icon={ShieldCheckIcon}
                          label="Assignment status"
                          value={
                            <Badge
                              variant={
                                salary.status === "ACTIVE"
                                  ? "success"
                                  : "secondary"
                              }
                            >
                              {salary.status.toLowerCase()}
                            </Badge>
                          }
                        />
                        <Link
                          href={`/salary-structures/${salary.structure.id}`}
                          className={buttonVariants({ variant: "outline" })}
                        >
                          Manage salary structure
                        </Link>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Salary components</CardTitle>
                        <CardDescription>
                          Deterministic inputs used by payroll; formulas are
                          controlled by the selected structure.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col divide-y">
                          {salary.structure.components.map((component) => (
                            <div
                              key={component.id}
                              className="grid grid-cols-[1fr_auto] gap-4 py-3 first:pt-0 last:pb-0"
                            >
                              <div>
                                <p className="text-sm font-medium">
                                  {component.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {component.code} ·{" "}
                                  {component.componentType
                                    .toLowerCase()
                                    .replaceAll("_", " ")}
                                </p>
                              </div>
                              <p className="text-sm font-medium tabular">
                                {component.calculationMode === "PERCENTAGE"
                                  ? `${component.value}%`
                                  : formatMoney(
                                      Number(component.value),
                                      salary.currency,
                                    )}
                              </p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()
            )}
          </TabsContent>
        ) : null}
        {canViewSecurity ? (
          <TabsContent value="security" className="pt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Account access</CardTitle>
                  <CardDescription>
                    Identity used to enter this company workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <Detail
                    icon={IdCardIcon}
                    label="Login ID"
                    value={profile.loginId}
                  />
                  <Detail
                    icon={MailIcon}
                    label="Work email"
                    value={profile.user?.email || profile.workEmail}
                  />
                  <Detail
                    icon={ShieldCheckIcon}
                    label="Account status"
                    value={
                      <Badge
                        variant={
                          profile.user?.status === "ACTIVE"
                            ? "success"
                            : "warning"
                        }
                      >
                        {profile.user?.status?.toLowerCase() || "unlinked"}
                      </Badge>
                    }
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Password and activation</CardTitle>
                  <CardDescription>
                    Passwords are never visible to Admins. Recovery and
                    activation use one-time expiring links.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-sm leading-6 text-muted-foreground">
                    Use password recovery for an active account. For an invited
                    employee, issue a fresh activation link from the profile
                    header.
                  </p>
                  <Link
                    href="/forgot-password"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-fit",
                    )}
                  >
                    Reset password securely
                  </Link>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ) : null}
      </Tabs>
    </main>
  );
}
