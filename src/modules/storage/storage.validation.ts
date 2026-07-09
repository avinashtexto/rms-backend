import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(10).toUpperCase()
});

export const updateRoomSchema = z.object({
  name: z.string().min(1).max(255).nullable().optional().transform(val => val === null ? undefined : val),
  isActive: z.boolean().nullable().optional().transform(val => val === null ? undefined : val)
});

export const createRackSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(10).toUpperCase()
});

export const updateRackSchema = z.object({
  name: z.string().min(1).max(255).nullable().optional().transform(val => val === null ? undefined : val),
  isActive: z.boolean().nullable().optional().transform(val => val === null ? undefined : val)
});

export const createShelfSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(10).toUpperCase()
});

export const updateShelfSchema = z.object({
  name: z.string().min(1).max(255).nullable().optional().transform(val => val === null ? undefined : val),
  isActive: z.boolean().nullable().optional().transform(val => val === null ? undefined : val)
});

export const createLocationSchema = z.object({
  name: z.string().min(1),
  barcode: z.string().min(1).optional() // optional, auto-generated if omitted
});

export const updateLocationSchema = z.object({
  name: z.string().min(1).max(255).nullable().optional().transform(val => val === null ? undefined : val),
  isActive: z.boolean().nullable().optional().transform(val => val === null ? undefined : val),
  isOccupied: z.boolean().nullable().optional().transform(val => val === null ? undefined : val)
});
