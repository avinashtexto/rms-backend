import { z } from 'zod';

export const createRoomSchema = z.object({
  warehouseId: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(2).max(10).toUpperCase(),
  description: z.string().optional(),
  location: z.string().max(255).optional()
});

export const updateRoomSchema = z.object({
  warehouseId: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  code: z.string().min(2).max(10).toUpperCase().optional(),
  description: z.string().optional(),
  location: z.string().max(255).optional(),
  isActive: z.boolean().optional()
});

export const createRowSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).max(20).toUpperCase().optional(),
  column: z.string().min(1).max(50),
  rowPrefix: z.string().min(1).max(20),
  noOfRows: z.coerce.number().int().positive().default(1),
  columnsInCell: z.coerce.number().int().positive(),
  rackId: z.string().uuid().optional(),
  floor: z.string().max(100).optional(),
  capacityOfCell: z.coerce.number().int().positive(),
  isTemporaryLocation: z.boolean().default(false),
  description: z.string().max(500).optional()
});

export const updateRowSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).max(20).toUpperCase().optional(),
  column: z.string().min(1).max(50).optional(),
  rowPrefix: z.string().min(1).max(20).optional(),
  columnsInCell: z.coerce.number().int().positive().optional(),
  rackId: z.string().uuid().nullable().optional(),
  floor: z.string().max(100).optional(),
  capacityOfCell: z.coerce.number().int().positive().optional(),
  isTemporaryLocation: z.boolean().optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional()
});

export type CreateRowInput = z.infer<typeof createRowSchema>;
export type UpdateRowInput = z.infer<typeof updateRowSchema>;
