import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().optional(),
  username: z.string().trim().optional(),
  password: z.string().min(6)
}).refine(data => data.email || data.username, {
  message: "Either email or username must be provided",
  path: ["email"]
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

export const deviceBindSchema = z.object({
  serialNumber: z.string().min(1),
  model: z.string().min(1)
});
