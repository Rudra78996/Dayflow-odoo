import { buildLoginId, normalizeNamePart } from './auth.utils';

describe('auth utilities', () => {
  it('generates the approved Login ID format', () => {
    expect(
      buildLoginId({
        companyPrefix: 'OI',
        firstName: 'John',
        lastName: 'Doe',
        joiningYear: 2022,
        sequence: 1,
      }),
    ).toBe('OIJODO20220001');
  });

  it('normalizes and pads short name parts', () => {
    expect(normalizeNamePart('É')).toBe('EX');
  });
});
