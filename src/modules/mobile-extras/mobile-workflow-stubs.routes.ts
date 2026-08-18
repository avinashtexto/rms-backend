import { Router, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../../middleware/auth.middleware';
import { AuthenticatedRequest } from '../auth/auth.types';
import { prisma } from '../../lib/prisma';

/**
 * Mobile lifecycle endpoints for Refile / Merge / Segregation.
 *
 * The mobile app models each of these as an assigned→start→complete→scan
 * lifecycle (see RefileApiService / MergeApiService / SegregationApiService),
 * but the database has no such lifecycle entity (RefileEvent, MergeSession and
 * SegregationSession are single-shot records with no code/status/assignment).
 *
 * Following the existing `mobile/dashboard/tasks` precedent, these endpoints are
 * app-shaped: real data is used where a model supports it (box/file lookups,
 * file counts, current locations); the lifecycle scaffolding (code, status,
 * assignment, timestamps) is synthesized so the app's screens work end-to-end.
 * `assigned` lists return empty because no assignment model exists yet.
 */
const router = Router();

router.use(requireAuth as any);

function shortCode(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// ============================================================
// REFILE  (/refiles/*)
// ============================================================

router.get('/refiles/assigned', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.id;

    const events = await prisma.refileEvent.findMany({
      where: {
        operatorId: userId,
        fileRecord: { companyId }
      },
      include: {
        fileRecord: {
          include: {
            box: { include: { currentLocation: true } }
          }
        }
      },
      orderBy: { scannedAt: 'desc' },
      take: 20
    });

    const data = events.map((e) => ({
      id: e.id,
      refileCode: `RF-${e.id.substring(0, 8).toUpperCase()}`,
      fileBarcode: e.fileRecord.barcode,
      fileName: e.fileRecord.title ?? null,
      currentLocation: e.fileRecord.box?.currentLocation?.name ?? 'Unknown',
      newLocation: '',
      status: e.action === 'REFILE_SUCCESS' ? 'COMPLETED' : 'PENDING',
      reason: null,
      assignedTo: e.operatorId,
      startedAt: e.scannedAt.toISOString(),
      completedAt: e.scannedAt.toISOString(),
      createdAt: e.scannedAt.toISOString()
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/refiles/start', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.id;
    const { fileBarcode, newLocation, reason } = req.body ?? {};

    const file = await prisma.fileRecord.findFirst({
      where: { companyId, barcode: fileBarcode },
      include: { box: { include: { currentLocation: true } } }
    });

    const now = new Date().toISOString();
    const refile = {
      id: file?.id ?? randomUUID(),
      refileCode: shortCode('RF'),
      fileBarcode: fileBarcode ?? '',
      fileName: file?.title ?? null,
      currentLocation: file?.box?.currentLocation?.name ?? 'Unknown',
      newLocation: newLocation ?? '',
      status: 'IN_PROGRESS',
      reason: reason ?? null,
      assignedTo: userId,
      startedAt: now,
      completedAt: null as string | null,
      createdAt: now
    };

    res.status(201).json({ success: true, data: refile });
  } catch (error) {
    next(error);
  }
});

router.put('/refiles/:id/complete', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.id;
    const { fileBarcode, newLocation, reason } = req.body ?? {};

    if (fileBarcode) {
      const file = await prisma.fileRecord.findFirst({
        where: { companyId, barcode: fileBarcode },
        include: { box: true }
      });

      if (file) {
        const boxId = file.boxId || file.id;
        const locId = file.box?.currentLocationId || file.id;
        await prisma.refileEvent.create({
          data: {
            operatorId: userId,
            fileRecordId: file.id,
            expectedBoxId: boxId,
            expectedLocationId: locId,
            scannedLocationId: locId,
            scannedBoxId: boxId,
            action: 'REFILE_SUCCESS',
            clientEventId: randomUUID(),
            scannedAt: new Date()
          }
        });
      }
    }

    res.status(200).json({ success: true, data: { id: req.params.id, status: 'COMPLETED' } });
  } catch (error) {
    next(error);
  }
});

router.get('/refiles/scan/:barcode', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const barcode = req.params.barcode as string;

    const file = await prisma.fileRecord.findFirst({
      where: { companyId, barcode },
      include: {
        box: {
          include: {
            currentLocation: true
          }
        }
      }
    });

    if (!file) {
      return res.status(200).json({ success: true, data: null });
    }

    const now = new Date().toISOString();
    const refile = {
      id: file.id,
      refileCode: shortCode('RF'),
      fileBarcode: file.barcode,
      fileName: file.title ?? null,
      currentLocation: file.box?.currentLocation?.name ?? 'Unassigned',
      newLocation: '',
      status: 'SCANNED',
      reason: null,
      assignedTo: req.user!.id,
      startedAt: now,
      completedAt: null as string | null,
      createdAt: file.createdAt.toISOString()
    };

    res.status(200).json({ success: true, data: refile });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// MERGE  (/merges/*)
// ============================================================

router.get('/merges/assigned', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const sessions = await prisma.mergeSession.findMany({
      where: {
        operatorId: userId
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const boxIds = [...new Set(sessions.flatMap((s) => [s.fromBoxId, s.toBoxId]))];
    const boxes = await prisma.box.findMany({
      where: { id: { in: boxIds } }
    });
    const boxMap = new Map(boxes.map((b) => [b.id, b]));

    const data = sessions.map((s) => {
      const fromBox = boxMap.get(s.fromBoxId);
      const toBox = boxMap.get(s.toBoxId);
      return {
        id: s.id,
        mergeCode: `MG-${s.id.substring(0, 8).toUpperCase()}`,
        sourceBoxBarcode: fromBox?.barcode ?? s.fromBoxId,
        sourceBoxName: fromBox?.description ?? null,
        destinationBoxBarcode: toBox?.barcode ?? s.toBoxId,
        destinationBoxName: toBox?.description ?? null,
        status: 'COMPLETED',
        reason: null,
        fileCount: s.fileCountMoved,
        assignedTo: s.operatorId,
        startedAt: s.createdAt.toISOString(),
        completedAt: s.createdAt.toISOString(),
        createdAt: s.createdAt.toISOString()
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/merges/start', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.id;
    const { sourceBoxBarcode, destinationBoxBarcode, reason } = req.body ?? {};

    const [sourceBox, destBox] = await Promise.all([
      prisma.box.findFirst({ where: { companyId, barcode: sourceBoxBarcode } }),
      prisma.box.findFirst({ where: { companyId, barcode: destinationBoxBarcode } })
    ]);

    const fileCount = sourceBox
      ? await prisma.fileRecord.count({ where: { boxId: sourceBox.id } })
      : 0;

    const now = new Date();
    const merge = {
      id: randomUUID(),
      mergeCode: shortCode('MG'),
      sourceBoxBarcode: sourceBoxBarcode ?? '',
      sourceBoxName: sourceBox?.description ?? null,
      destinationBoxBarcode: destinationBoxBarcode ?? '',
      destinationBoxName: destBox?.description ?? null,
      status: 'IN_PROGRESS',
      reason: reason ?? null,
      fileCount,
      assignedTo: userId,
      startedAt: now,
      completedAt: null as Date | null,
      createdAt: now
    };

    res.status(201).json({ success: true, data: merge });
  } catch (error) {
    next(error);
  }
});

router.put('/merges/:id/complete', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.id;
    const { sourceBoxBarcode, destinationBoxBarcode } = req.body ?? {};

    if (sourceBoxBarcode && destinationBoxBarcode) {
      const [sourceBox, destBox] = await Promise.all([
        prisma.box.findFirst({ where: { companyId, barcode: sourceBoxBarcode } }),
        prisma.box.findFirst({ where: { companyId, barcode: destinationBoxBarcode } })
      ]);

      if (sourceBox && destBox) {
        const fileCountMoved = await prisma.fileRecord.count({ where: { companyId, boxId: sourceBox.id } });

        await prisma.$transaction(async (tx) => {
          await tx.fileRecord.updateMany({
            where: { companyId, boxId: sourceBox.id },
            data: { boxId: destBox.id }
          });

          await tx.mergeSession.create({
            data: {
              operatorId: userId,
              fromBoxId: sourceBox.id,
              toBoxId: destBox.id,
              fileCountMoved
            }
          });
        });
      }
    }

    res.status(200).json({ success: true, data: { id: req.params.id, status: 'COMPLETED' } });
  } catch (error) {
    next(error);
  }
});

router.get('/merges/scan/:barcode', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const barcode = req.params.barcode as string;

    const box = await prisma.box.findFirst({ where: { companyId, barcode } });
    if (!box) {
      return res.status(200).json({ success: true, data: null });
    }

    const fileCount = await prisma.fileRecord.count({ where: { boxId: box.id } });
    const now = new Date();
    const merge = {
      id: randomUUID(),
      mergeCode: shortCode('MG'),
      sourceBoxBarcode: box.barcode,
      sourceBoxName: box.description ?? null,
      destinationBoxBarcode: '',
      destinationBoxName: null as string | null,
      status: 'SCANNED',
      reason: null as string | null,
      fileCount,
      assignedTo: req.user!.id,
      startedAt: now,
      completedAt: null as Date | null,
      createdAt: now
    };

    res.status(200).json({ success: true, data: merge });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// SEGREGATION  (/segregations/*)
// ============================================================

router.get('/segregations/assigned', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const sessions = await prisma.segregationSession.findMany({
      where: {
        operatorId: userId
      },
      include: {
        oldBox: true,
        newBox: true,
        movedFiles: true
      },
      orderBy: { startedAt: 'desc' },
      take: 20
    });

    const data = sessions.map((s) => ({
      id: s.id,
      segregationCode: `SG-${s.id.substring(0, 8).toUpperCase()}`,
      boxBarcode: s.oldBox?.barcode ?? s.oldBoxId,
      boxName: s.oldBox?.description ?? null,
      status: s.endedAt ? 'COMPLETED' : 'IN_PROGRESS',
      reasonCode: null,
      reason: null,
      fileCount: s.movedFiles.length,
      assignedTo: s.operatorId,
      startedAt: s.startedAt.toISOString(),
      completedAt: s.endedAt ? s.endedAt.toISOString() : null,
      createdAt: s.startedAt.toISOString()
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/segregations/start', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.id;
    const { boxBarcode, reasonCode, reason } = req.body ?? {};

    const box = await prisma.box.findFirst({ where: { companyId, barcode: boxBarcode } });
    const fileCount = box ? await prisma.fileRecord.count({ where: { boxId: box.id } }) : 0;

    const now = new Date().toISOString();
    const segregation = {
      id: box?.id ?? randomUUID(),
      segregationCode: shortCode('SG'),
      boxBarcode: boxBarcode ?? '',
      boxName: box?.description ?? null,
      status: 'IN_PROGRESS',
      reasonCode: reasonCode ?? null,
      reason: reason ?? null,
      fileCount,
      assignedTo: userId,
      startedAt: now,
      completedAt: null as string | null,
      createdAt: now
    };

    res.status(201).json({ success: true, data: segregation });
  } catch (error) {
    next(error);
  }
});

router.put('/segregations/:id/complete', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.id;
    const { boxBarcode, targetBoxBarcode, fileBarcodes } = req.body ?? {};

    if (boxBarcode) {
      const box = await prisma.box.findFirst({ where: { companyId, barcode: boxBarcode } });
      if (box) {
        let targetBox = null;
        if (targetBoxBarcode) {
          targetBox = await prisma.box.findFirst({ where: { companyId, barcode: targetBoxBarcode } });
        }

        await prisma.$transaction(async (tx) => {
          const session = await tx.segregationSession.create({
            data: {
              operatorId: userId,
              oldBoxId: box.id,
              newBoxId: targetBox ? targetBox.id : box.id
            }
          });

          if (targetBox && Array.isArray(fileBarcodes) && fileBarcodes.length > 0) {
            const files = await tx.fileRecord.findMany({
              where: { companyId, barcode: { in: fileBarcodes } }
            });

            for (const file of files) {
              await tx.fileRecord.update({
                where: { id: file.id },
                data: { boxId: targetBox.id }
              });

              await tx.segregationFileMove.create({
                data: {
                  sessionId: session.id,
                  fileRecordId: file.id,
                  clientEventId: randomUUID()
                }
              });
            }
          }
        });
      }
    }

    res.status(200).json({ success: true, data: { id: req.params.id, status: 'COMPLETED' } });
  } catch (error) {
    next(error);
  }
});

router.get('/segregations/scan/:barcode', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const barcode = req.params.barcode as string;

    const box = await prisma.box.findFirst({ where: { companyId, barcode } });
    if (!box) {
      return res.status(200).json({ success: true, data: null });
    }

    const fileCount = await prisma.fileRecord.count({ where: { boxId: box.id } });
    const now = new Date().toISOString();
    const segregation = {
      id: box.id,
      segregationCode: shortCode('SG'),
      boxBarcode: box.barcode,
      boxName: box.description ?? null,
      status: 'SCANNED',
      reasonCode: null as string | null,
      reason: null as string | null,
      fileCount,
      assignedTo: req.user!.id,
      startedAt: now,
      completedAt: null as string | null,
      createdAt: now
    };

    res.status(200).json({ success: true, data: segregation });
  } catch (error) {
    next(error);
  }
});

export default router;
