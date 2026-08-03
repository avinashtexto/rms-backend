import { z } from 'zod';
import { WorkflowAction } from '@prisma/client';

export const auditEntityTypes = ['BOX', 'FILE_RECORD', 'LOCATION', 'USER', 'DEVICE'] as const;

export const listAuditLogsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  boxId: z.string().uuid().optional(),
  fileRecordId: z.string().uuid().optional(),
  action: z.nativeEnum(WorkflowAction).optional(),
  entityType: z.enum(auditEntityTypes).optional(),
  entityId: z.string().trim().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  page: z.preprocess(
    (val) => (val === undefined ? 1 : parseInt(val as string, 10)),
    z.number().int().min(1).default(1)
  ),
  limit: z.preprocess(
    (val) => (val === undefined ? 20 : parseInt(val as string, 10)),
    z.number().int().min(1).max(200).default(20)
  ),
  pageSize: z.preprocess(
    (val) => (val === undefined ? undefined : parseInt(val as string, 10)),
    z.number().int().min(1).max(200).optional()
  )
});
