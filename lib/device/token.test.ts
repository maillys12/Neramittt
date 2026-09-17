import { describe, expect, it } from 'vitest';
import { DEVICE_TOKEN_KEY, createDeviceToken } from './token';
describe('device token',()=>{it('preserves legacy storage key',()=>expect(DEVICE_TOKEN_KEY).toBe('neramit_device_token_v1'));it('creates a strong token',()=>{const token=createDeviceToken();expect(token.length).toBeGreaterThanOrEqual(32);expect(token).not.toBe(createDeviceToken());});});
