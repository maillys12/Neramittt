import { describe, expect, it } from 'vitest';
import { getBearerToken } from '@/lib/member/auth';

describe('member auth bearer parser', () => {
  it('rejects a missing header', () => {
    expect(() => getBearerToken(new Request('https://example.test'))).toThrow('MEMBER_REQUIRED');
  });

  it('rejects non-bearer auth', () => {
    expect(() => getBearerToken(new Request('https://example.test', { headers: { authorization: 'Basic abc' } }))).toThrow('MEMBER_REQUIRED');
  });

  it('returns the bearer token', () => {
    const req = new Request('https://example.test', { headers: { authorization: 'Bearer token123' } });
    expect(getBearerToken(req)).toBe('token123');
  });
});
