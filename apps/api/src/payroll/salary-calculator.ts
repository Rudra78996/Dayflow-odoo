import {
  Prisma,
  SalaryBasis,
  SalaryCalculationMode,
  SalaryComponentType,
} from '../generated/prisma/client';

export interface ComponentInput {
  code: string;
  name: string;
  componentType: SalaryComponentType;
  calculationMode: SalaryCalculationMode;
  basis?: SalaryBasis | null;
  basisComponentCode?: string | null;
  value: number | string | Prisma.Decimal;
  displayOrder: number;
}
export interface ComponentResult {
  code: string;
  name: string;
  type: SalaryComponentType;
  amount: string;
  basisAmount: string | null;
  rate: string | null;
}
type DecimalValue = string | number | Prisma.Decimal;
const money = (value: DecimalValue) =>
  new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

export function calculateSalary(
  monthlyWage: DecimalValue,
  inputs: ComponentInput[],
) {
  const wage = money(monthlyWage);
  if (wage.lte(0)) throw new Error('Monthly wage must be positive');
  const codes = new Set<string>();
  for (const input of inputs) {
    input.code = input.code.trim().toUpperCase();
    if (codes.has(input.code))
      throw new Error(`Duplicate salary component code: ${input.code}`);
    codes.add(input.code);
    const value = new Prisma.Decimal(input.value);
    if (
      value.lt(0) ||
      (input.calculationMode === SalaryCalculationMode.PERCENTAGE &&
        value.gt(100))
    )
      throw new Error(`Invalid value for ${input.code}`);
  }
  const balancing = inputs.filter(
    (input) => input.componentType === SalaryComponentType.BALANCING,
  );
  if (balancing.length > 1)
    throw new Error('Only one balancing component is allowed');
  const byCode = new Map(inputs.map((input) => [input.code, input]));
  const results = new Map<string, ComponentResult>();
  const visiting = new Set<string>();
  const resolve = (code: string): ComponentResult => {
    const existing = results.get(code);
    if (existing) return existing;
    const input = byCode.get(code);
    if (!input) throw new Error(`Missing salary component basis: ${code}`);
    if (input.componentType === SalaryComponentType.BALANCING)
      throw new Error(
        'A balancing component cannot be used as a calculation basis',
      );
    if (visiting.has(code))
      throw new Error(`Circular salary component dependency at ${code}`);
    visiting.add(code);
    let amount: Prisma.Decimal;
    let basisAmount: Prisma.Decimal | null = null;
    let rate: Prisma.Decimal | null = null;
    if (input.calculationMode === SalaryCalculationMode.FIXED)
      amount = money(input.value);
    else {
      rate = new Prisma.Decimal(input.value);
      if (input.basis === SalaryBasis.WAGE) basisAmount = wage;
      else {
        const basisCode =
          input.basis === SalaryBasis.BASIC
            ? 'BASIC'
            : input.basisComponentCode?.trim().toUpperCase();
        if (!basisCode || basisCode === code)
          throw new Error(`Invalid percentage basis for ${code}`);
        basisAmount = new Prisma.Decimal(resolve(basisCode).amount);
      }
      amount = money(basisAmount.mul(rate).div(100));
    }
    visiting.delete(code);
    const result = {
      code,
      name: input.name,
      type: input.componentType,
      amount: amount.toFixed(2),
      basisAmount: basisAmount?.toFixed(2) ?? null,
      rate: rate?.toFixed(4) ?? null,
    };
    results.set(code, result);
    return result;
  };
  for (const input of inputs.filter(
    (entry) => entry.componentType !== SalaryComponentType.BALANCING,
  ))
    resolve(input.code);
  if (balancing[0]) {
    const fixedEarnings = [...results.values()]
      .filter((result) => result.type === SalaryComponentType.EARNING)
      .reduce((sum, result) => sum.plus(result.amount), new Prisma.Decimal(0));
    const remainder = money(wage.minus(fixedEarnings));
    if (remainder.lt(0))
      throw new Error(
        'Configured earnings exceed monthly wage; balancing amount would be negative',
      );
    results.set(balancing[0].code, {
      code: balancing[0].code,
      name: balancing[0].name,
      type: SalaryComponentType.BALANCING,
      amount: remainder.toFixed(2),
      basisAmount: wage.toFixed(2),
      rate: null,
    });
  }
  const components = [...results.values()].sort(
    (a, b) =>
      (byCode.get(a.code)?.displayOrder ?? 0) -
      (byCode.get(b.code)?.displayOrder ?? 0),
  );
  const total = (types: SalaryComponentType[]) =>
    components
      .filter((item) => types.includes(item.type))
      .reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
  const gross = total([
    SalaryComponentType.EARNING,
    SalaryComponentType.BALANCING,
  ]);
  if (!gross.eq(wage))
    throw new Error(
      'Configured earnings must reconcile exactly to the monthly wage',
    );
  const deductions = total([SalaryComponentType.DEDUCTION]);
  const employerContributions = total([
    SalaryComponentType.EMPLOYER_CONTRIBUTION,
  ]);
  return {
    wage: wage.toFixed(2),
    components,
    gross: gross.toFixed(2),
    deductions: deductions.toFixed(2),
    employerContributions: employerContributions.toFixed(2),
    net: money(gross.minus(deductions)).toFixed(2),
    employerCost: money(gross.plus(employerContributions)).toFixed(2),
  };
}

export function prorateSalary(
  calculation: ReturnType<typeof calculateSalary>,
  payableUnits: DecimalValue,
  scheduledUnits: DecimalValue,
) {
  const scheduled = new Prisma.Decimal(scheduledUnits);
  const payable = new Prisma.Decimal(payableUnits);
  if (scheduled.lte(0) || payable.lt(0) || payable.gt(scheduled))
    throw new Error('Invalid payable-day ratio');
  const ratio = payable.div(scheduled);
  const components = calculation.components.map((component) => ({
    ...component,
    fullAmount: component.amount,
    amount: money(new Prisma.Decimal(component.amount).mul(ratio)).toFixed(2),
  }));
  const total = (types: SalaryComponentType[]) =>
    components
      .filter((item) => types.includes(item.type))
      .reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
  const gross = total([
    SalaryComponentType.EARNING,
    SalaryComponentType.BALANCING,
  ]);
  const deductions = total([SalaryComponentType.DEDUCTION]);
  const employerContributions = total([
    SalaryComponentType.EMPLOYER_CONTRIBUTION,
  ]);
  return {
    ratio: ratio.toDecimalPlaces(8).toString(),
    components,
    gross: gross.toFixed(2),
    deductions: deductions.toFixed(2),
    employerContributions: employerContributions.toFixed(2),
    net: money(gross.minus(deductions)).toFixed(2),
  };
}
