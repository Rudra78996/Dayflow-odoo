import { PayrollScreen } from "@/components/hr/payroll-screen";
export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PayrollScreen runId={id} />; }
