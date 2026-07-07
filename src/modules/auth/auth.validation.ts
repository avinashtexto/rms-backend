import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

export const deviceBindSchema = z.object({
  serialNumber: z.string().min(1),
  model: z.string().min(1)
});
