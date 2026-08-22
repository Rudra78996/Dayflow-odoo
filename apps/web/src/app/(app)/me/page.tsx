"use client";

import { useEffect, useState } from "react";
import { apiFetch, type CurrentAccount } from "@/lib/api";
import { EmployeeProfile } from "@/components/employees/employee-profile";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export default function MyProfilePage() {
  const [user, setUser] = useState<CurrentAccount | null>(null);
  useEffect(() => { void apiFetch<CurrentAccount>("/auth/me").then(setUser); }, []);
  if (!user) return <main className="p-6"><Skeleton className="h-72 rounded-xl" /></main>;
  if (!user.employee?.id) return <main className="p-6"><Empty><EmptyHeader><EmptyTitle>No employee profile linked</EmptyTitle><EmptyDescription>Ask an administrator to connect this user to an employee record.</EmptyDescription></EmptyHeader></Empty></main>;
  return <EmployeeProfile employeeId={user.employee.id} />;
}
