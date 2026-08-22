import {
  SalaryBasis,
  SalaryCalculationMode,
  SalaryComponentType,
} from '../generated/prisma/client';
import { calculateSalary, prorateSalary } from './salary-calculator';
const component = (
  code: string,
  type: SalaryComponentType,
  mode: SalaryCalculationMode,
  value: number,
  basis?: SalaryBasis,
  basisComponentCode?: string,
) => ({
  code,
  name: code,
  componentType: type,
  calculationMode: mode,
  value,
  basis,
  basisComponentCode,
  displayOrder: 1,
});
describe('salary calculator', () => {
  it('calculates the INR 50,000 formula exactly', () => {
    const result = calculateSalary('50000', [
      component(
        'BASIC',
        SalaryComponentType.EARNING,
        SalaryCalculationMode.PERCENTAGE,
        50,
        SalaryBasis.WAGE,
      ),
      component(
        'HRA',
        SalaryComponentType.EARNING,
        SalaryCalculationMode.PERCENTAGE,
        50,
        SalaryBasis.BASIC,
      ),
      component(
        'FIXED',
        SalaryComponentType.BALANCING,
        SalaryCalculationMode.FIXED,
        0,
      ),
      component(
        'EMPLOYEE_PF',
        SalaryComponentType.DEDUCTION,
        SalaryCalculationMode.PERCENTAGE,
        12,
        SalaryBasis.BASIC,
      ),
      component(
        'EMPLOYER_PF',
        SalaryComponentType.EMPLOYER_CONTRIBUTION,
        SalaryCalculationMode.PERCENTAGE,
        12,
        SalaryBasis.BASIC,
      ),
      component(
        'PT',
        SalaryComponentType.DEDUCTION,
        SalaryCalculationMode.FIXED,
        200,
      ),
    ]);
    expect(
      result.components.find((item) => item.code === 'BASIC')?.amount,
    ).toBe('25000.00');
    expect(result.components.find((item) => item.code === 'HRA')?.amount).toBe(
      '12500.00',
    );
    expect(
      result.components.find((item) => item.code === 'FIXED')?.amount,
    ).toBe('12500.00');
    expect(result).toMatchObject({
      gross: '50000.00',
      deductions: '3200.00',
      employerContributions: '3000.00',
      net: '46800.00',
    });
  });
  it('detects circular component formulas and negative balancing', () => {
    expect(() =>
      calculateSalary(100, [
        component(
          'A',
          SalaryComponentType.EARNING,
          SalaryCalculationMode.PERCENTAGE,
          10,
          SalaryBasis.COMPONENT,
          'B',
        ),
        component(
          'B',
          SalaryComponentType.EARNING,
          SalaryCalculationMode.PERCENTAGE,
          10,
          SalaryBasis.COMPONENT,
          'A',
        ),
      ]),
    ).toThrow(/Circular/);
    expect(() =>
      calculateSalary(100, [
        component(
          'A',
          SalaryComponentType.EARNING,
          SalaryCalculationMode.FIXED,
          101,
        ),
        component(
          'BALANCE',
          SalaryComponentType.BALANCING,
          SalaryCalculationMode.FIXED,
          0,
        ),
      ]),
    ).toThrow(/negative/);
  });
  it('rejects an earning structure that does not reconcile to the wage', () => {
    expect(() =>
      calculateSalary(100, [
        component(
          'BASIC',
          SalaryComponentType.EARNING,
          SalaryCalculationMode.PERCENTAGE,
          50,
          SalaryBasis.WAGE,
        ),
      ]),
    ).toThrow(/reconcile exactly/);
  });
  it('prorates through decimal arithmetic', () => {
    const full = calculateSalary(50_000, [
      component(
        'BASIC',
        SalaryComponentType.EARNING,
        SalaryCalculationMode.PERCENTAGE,
        50,
        SalaryBasis.WAGE,
      ),
      component(
        'BALANCE',
        SalaryComponentType.BALANCING,
        SalaryCalculationMode.FIXED,
        0,
      ),
    ]);
    expect(prorateSalary(full, '15', '20')).toMatchObject({
      ratio: '0.75',
      gross: '37500.00',
      net: '37500.00',
    });
  });
});
