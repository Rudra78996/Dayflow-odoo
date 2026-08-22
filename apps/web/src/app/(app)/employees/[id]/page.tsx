import { EmployeeProfile } from "@/components/employees/employee-profile";

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmployeeProfile employeeId={id} />;
}
