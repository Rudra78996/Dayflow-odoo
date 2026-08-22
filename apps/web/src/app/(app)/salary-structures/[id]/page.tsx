import { SalaryStructureDetail } from "@/components/hr/salary-structure-detail";
export default async function SalaryStructurePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <SalaryStructureDetail structureId={id} />; }
