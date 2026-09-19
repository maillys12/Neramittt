import { describe, expect, it } from 'vitest';
import { normalizeUsername, usernameSchema } from '@/lib/member/profile';

describe('member profile validation', () => {
  it('normalizes usernames to lowercase', () => {
    expect(normalizeUsername('  Chanakan_67 ')).toBe('chanakan_67');
  });

  it('accepts 3-24 lowercase letters numbers underscores', () => {
    expect(usernameSchema.safeParse('chanakan_67').success).toBe(true);
  });

  it('rejects spaces and symbols', () => {
    expect(usernameSchema.safeParse('chan akan!').success).toBe(false);
  });
});
