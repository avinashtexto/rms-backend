import { z } from 'zod';

const syncEventSchema = z.object({
  eventType: z.enum(['FRESH_BOX_MOVE', 'INVENTORY_VERIFY', 'REFILE']),
  clientEventId: z.string().uuid(),
  sessionId: z.string().uuid(),
  payload: z.any(),
  scannedAt: z.string().transform((val) => new Date(val))
});

export const syncBatchSchema = z.object({
  deviceId: z.string().uuid().optional(),
  events: z.array(syncEventSchema)
});

export const resolveConflictSchema = z.object({
  resolution: z.enum(['CLIENT_WIN', 'SERVER_WIN'])
});
