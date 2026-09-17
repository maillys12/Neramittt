export const DEVICE_TOKEN_KEY='neramit_device_token_v1';
export function createDeviceToken(){return crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');}
export function getOrCreateDeviceToken(){if(typeof window==='undefined')return '';const existing=localStorage.getItem(DEVICE_TOKEN_KEY);if(existing)return existing;const token=createDeviceToken();localStorage.setItem(DEVICE_TOKEN_KEY,token);return token;}
