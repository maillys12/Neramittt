export function readDeviceToken(req:Request){const token=req.headers.get('x-neramit-device');if(!token||token.length<32)throw new Error('INVALID_DEVICE_TOKEN');return token;}
