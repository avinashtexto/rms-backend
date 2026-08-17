import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

export const rackTemplateBaseSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50).transform((v) => v.toUpperCase()),
  description: z.string().max(500).optional(),
  warehouseType: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'CUSTOM']).default('CUSTOM'),
  rowsCount: positiveInt,
  racksCount: positiveInt,
  levelsCount: positiveInt,
  locationPerLevel: positiveInt.optional(),
  locRows: positiveInt.optional(),
  locCols: positiveInt.optional(),
  rowPrefix: z.string().min(1).max(20).default('ROW'),
  rackPrefix: z.string().min(1).max(20).default('R'),
  levelPrefix: z.string().min(1).max(20).default('L'),
  locationPrefix: z.string().min(1).max(20).default('LOC'),
  locationPadding: z.coerce.number().int().min(1).max(6).default(3),
  locationNaming: z.enum(['AUTO', 'MANUAL']).default('AUTO'),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE')
});

export const createRackTemplateSchema = rackTemplateBaseSchema;

export const updateRackTemplateSchema = rackTemplateBaseSchema.partial();

export const cloneRackTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50).transform((v) => v.toUpperCase())
});

export const applyRackTemplateSchema = z.object({
  warehouseId: z.string().uuid(),
  roomId: z.string().uuid()
});

export type ApplyRackTemplateInput = z.infer<typeof applyRackTemplateSchema>;
export type CloneRackTemplateInput = z.infer<typeof cloneRackTemplateSchema>;

export const listRackTemplateQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).default('ALL'),
  warehouseType: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'CUSTOM', 'ALL']).default('ALL')
});

export type CreateRackTemplateInput = z.infer<typeof createRackTemplateSchema>;
export type UpdateRackTemplateInput = z.infer<typeof updateRackTemplateSchema>;
