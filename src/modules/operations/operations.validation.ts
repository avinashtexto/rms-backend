import { z } from 'zod';
import { OperationType } from '@prisma/client';

export const listOperationsQuerySchema = z.object({
  page: z.preprocess(
    (val) => (val === undefined ? 1 : parseInt(val as string, 10)),
    z.number().int().min(1).default(1)
  ),
  limit: z.preprocess(
    (val) => (val === undefined ? 20 : parseInt(val as string, 10)),
    z.number().int().min(1).max(200).default(20)
  ),
  type: z.nativeEnum(OperationType).optional(),
  status: z.enum(['COMPLETED', 'REJECTED']).optional(),
  mine: z
    .preprocess((val) => {
      if (val === undefined) return undefined;
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  warehouseId: z.string().uuid().optional(),
  hasMissing: z
    .preprocess((val) => {
      if (val === undefined) return undefined;
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
});
