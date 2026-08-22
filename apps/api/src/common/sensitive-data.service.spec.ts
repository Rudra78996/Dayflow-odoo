import { ConfigService } from '@nestjs/config';
import { SensitiveDataService } from './sensitive-data.service';

describe('SensitiveDataService', () => {
  const config = new ConfigService({
    DATA_ENCRYPTION_KEY: 'test-only-key-with-at-least-32-characters',
  });
  const service = new SensitiveDataService(config);

  it('encrypts sensitive values with authenticated encryption', () => {
    const encrypted = service.encrypt('123456789012');
    expect(encrypted).not.toContain('123456789012');
    expect(service.decrypt(encrypted)).toBe('123456789012');
  });

  it('rejects modified ciphertext', () => {
    const encrypted = service.encrypt('ABCDE1234F');
    expect(() => service.decrypt(encrypted.slice(0, -2) + 'aa')).toThrow();
  });
});
