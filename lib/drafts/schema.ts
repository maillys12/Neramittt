import{z}from'zod';export const draftInputSchema=z.object({mode:z.enum(['chat','form']),title:z.string().max(200).optional(),brief:z.record(z.string(),z.unknown()).default({})});
