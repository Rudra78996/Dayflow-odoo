import { isAllowedOrigin } from './origin-policy';

describe('origin policy', () => {
  it('allows an explicitly configured production origin', () => {
    expect(
      isAllowedOrigin(
        'https://people.dayflow.example',
        'https://people.dayflow.example',
        'production',
      ),
    ).toBe(true);
  });

  it('rejects an unconfigured production origin', () => {
    expect(
      isAllowedOrigin(
        'https://attacker.example',
        'https://people.dayflow.example',
        'production',
      ),
    ).toBe(false);
  });

  it('allows loopback ports selected by Next.js in development', () => {
    expect(
      isAllowedOrigin(
        'http://localhost:3002',
        'http://localhost:3000',
        'development',
      ),
    ).toBe(true);
    expect(
      isAllowedOrigin(
        'http://127.0.0.1:3010',
        'http://localhost:3000',
        'development',
      ),
    ).toBe(true);
  });

  it('does not broaden development access beyond loopback hosts', () => {
    expect(
      isAllowedOrigin(
        'http://192.168.1.20:3000',
        'http://localhost:3000',
        'development',
      ),
    ).toBe(false);
  });
});
