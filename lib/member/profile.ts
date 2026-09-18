import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/);

export const displayNameSchema = z.string().trim().min(1).max(80);

export const onboardingSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
}).strict();

export const profileUpdateSchema = z.object({
  displayName: displayNameSchema,
}).strict();

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export type MemberProfile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  onboarding_completed: boolean;
  deletion_requested_at: string | null;
  created_at: string;
  updated_at: string;
};
