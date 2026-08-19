import { Router, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { AuthenticatedRequest } from '../auth/auth.types';
import { prisma } from '../../lib/prisma';
import { AuditService } from '../audit/audit.service';
import { FileRecordService } from '../fileRecord/fileRecord.service';

/**
 * Mobile search endpoints.
 *
 * The mobile app (`SearchApiService`) calls:
 *   GET /search?query=<q>&type=<BOX|FILE|ALL>   -> List<SearchResultDto>
 *   GET /search/barcode?barcode=<code>          -> SearchResultDto?  (nullable)
 *
 * These are mounted BEFORE the shared `boxRoutes` on the mobile router so the
 * app's `query`/`type` params and the `SearchResultDto` response shape are
 * served here rather than by the admin-shared `/search` handler (which reads
 * `?q=` and returns a different shape).
 */
const router = Router();

router.use(requireAuth as any);

// Shape a Box row into the SearchResultDto the app expects.
function boxToResult(box: any) {
  return {
    type: 'BOX',
    id: box.id,
    barcode: box.barcode,
    name: box.description ?? null,
    title: null as string | null,
    location: box.currentLocation?.name ?? 'Unassigned',
    clientId: box.clientId ?? null,
    clientName: box.client?.name ?? null,
    boxBarcode: box.barcode
  };
}

// Shape a FileRecord row (with its box) into the SearchResultDto the app expects.
function fileToResult(file: any) {
  return {
    type: 'FILE',
    id: file.id,
    barcode: file.barcode,
    name: null as string | null,
    title: file.title ?? null,
    location: file.box?.currentLocation?.name ?? 'Unassigned',
    clientId: file.box?.clientId ?? null,
    clientName: file.box?.client?.name ?? null,
    boxBarcode: file.box?.barcode ?? null
  };
}

const boxInclude = { client: true, currentLocation: true };
const fileInclude = { box: { include: { client: true, currentLocation: true } } };

// GET /search?query=&type=
router.get('/search', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const query = ((req.query.query as string) || (req.query.q as string) || '').trim();
    const type = ((req.query.type as string) || 'ALL').toUpperCase();

    const results: any[] = [];

    if (type === 'BOX' || type === 'ALL') {
      const boxes = await prisma.box.findMany({
        where: {
          companyId,
          ...(query
            ? { OR: [{ barcode: { contains: query, mode: 'insensitive' } }, { description: { contains: query, mode: 'insensitive' } }] }
            : {})
        },
        include: boxInclude,
        take: 25,
        orderBy: { createdAt: 'desc' }
      });
      results.push(...boxes.map(boxToResult));
    }

    if (type === 'FILE' || type === 'ALL') {
      const files = await prisma.fileRecord.findMany({
        where: {
          companyId,
          ...(query
            ? { OR: [{ barcode: { contains: query, mode: 'insensitive' } }, { title: { contains: query, mode: 'insensitive' } }] }
            : {})
        },
        include: fileInclude,
        take: 25,
        orderBy: { createdAt: 'desc' }
      });
      results.push(...files.map(fileToResult));
    }

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

// GET /search/barcode?barcode=  -> single result or null
router.get('/search/barcode', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const barcode = ((req.query.barcode as string) || '').trim();

    if (!barcode) {
      return res.status(200).json({ success: true, data: null });
    }

    const box = await prisma.box.findFirst({
      where: { companyId, barcode },
      include: boxInclude
    });
    if (box) {
      return res.status(200).json({ success: true, data: boxToResult(box) });
    }

    const file = await prisma.fileRecord.findFirst({
      where: { companyId, barcode },
      include: fileInclude
    });
    if (file) {
      return res.status(200).json({ success: true, data: fileToResult(file) });
    }

    return res.status(200).json({ success: true, data: null });
  } catch (error) {
    next(error);
  }
});

// GET /search/boxes/:id and /boxes/:id -> BoxDetailDto
router.get(['/search/boxes/:id', '/boxes/:id'], async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const boxId = String(req.params.id);

    let box: any = await prisma.box.findFirst({
      where: {
        companyId,
        OR: [{ id: boxId }, { barcode: boxId }]
      },
      include: {
        client: true,
        currentLocation: {
          include: {
            shelf: {
              include: {
                rack: {
                  include: {
                    room: {
                      include: {
                        warehouse: {
                          include: {
                            site: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        fileRecords: true
      }
    });

    if (!box) {
      // Check BarcodeMaster for pre-generated/registered Box barcodes
      const barcodeMaster = await prisma.barcodeMaster.findFirst({
        where: {
          companyId,
          OR: [{ id: boxId }, { barcode: boxId }],
          type: 'BOX'
        },
        include: { warehouse: { include: { site: true } }, site: true, branch: true }
      });

      if (barcodeMaster) {
        if (barcodeMaster.assignedToId) {
          box = await prisma.box.findFirst({
            where: { id: barcodeMaster.assignedToId, companyId },
            include: {
              client: true,
              currentLocation: {
                include: {
                  shelf: {
                    include: {
                      rack: {
                        include: {
                          room: {
                            include: {
                              warehouse: {
                                include: {
                                  site: true
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              fileRecords: true
            }
          });
        }

        if (!box) {
          return res.status(200).json({
            success: true,
            data: {
              id: barcodeMaster.id,
              barcode: barcodeMaster.barcode,
              name: barcodeMaster.remarks || `Box Barcode ${barcodeMaster.barcode}`,
              boxType: 'STANDARD',
              warehouse: barcodeMaster.warehouse?.name ?? 'Unassigned',
              site: barcodeMaster.site?.name ?? barcodeMaster.warehouse?.site?.name ?? 'Unassigned',
              location: barcodeMaster.warehouse?.name ?? 'Unassigned',
              status: barcodeMaster.status,
              fileCount: 0,
              lastActivity: barcodeMaster.updatedAt ? new Date(barcodeMaster.updatedAt).toISOString() : new Date().toISOString(),
              contents: [],
              clientId: '',
              clientName: null
            }
          });
        }
      }
    }

    if (!box) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Box not found' } });
    }

    const loc = box.currentLocation;
    let locationStr = 'Unassigned';
    let warehouseName = 'Unassigned';
    let siteName = 'Unassigned';

    if (loc) {
      const wh = loc.shelf?.rack?.room?.warehouse;
      if (wh) {
        warehouseName = wh.name;
        if (wh.site) siteName = wh.site.name;
      }
      const parts = [
        wh?.name,
        loc.shelf?.rack?.room?.name,
        loc.shelf?.rack?.name,
        loc.shelf?.name,
        loc.name
      ].filter(Boolean);
      locationStr = parts.length > 0 ? parts.join(' › ') : loc.name;
    }

    const boxDetail = {
      id: box.id,
      barcode: box.barcode,
      name: box.description ?? null,
      boxType: 'STANDARD',
      warehouse: warehouseName,
      site: siteName,
      location: locationStr,
      status: box.status,
      fileCount: box.fileRecords?.length ?? 0,
      lastActivity: box.updatedAt ? new Date(box.updatedAt).toISOString() : new Date().toISOString(),
      contents: (box.fileRecords ?? []).map((f: any) => ({
        id: f.id,
        barcode: f.barcode,
        title: f.title ?? f.barcode,
        boxBarcode: box.barcode
      })),
      clientId: box.clientId ?? '',
      clientName: box.client?.name ?? null
    };

    res.status(200).json({ success: true, data: boxDetail });
  } catch (error) {
    next(error);
  }
});

// GET /search/files/:id -> FileDetailDto
router.get('/search/files/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const fileId = String(req.params.id);

    const file: any = await prisma.fileRecord.findFirst({
      where: {
        companyId,
        OR: [{ id: fileId }, { barcode: fileId }]
      },
      include: {
        box: {
          include: {
            client: true,
            currentLocation: {
              include: {
                shelf: {
                  include: {
                    rack: {
                      include: {
                        room: {
                          include: {
                            warehouse: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        refileEvents: {
          take: 10,
          orderBy: { scannedAt: 'desc' }
        }
      }
    });

    if (!file) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
    }

    const loc = file.box?.currentLocation;
    const locationChain: string[] = [];
    if (loc?.shelf?.rack?.room?.warehouse?.name) locationChain.push(loc.shelf.rack.room.warehouse.name);
    if (loc?.shelf?.rack?.room?.name) locationChain.push(loc.shelf.rack.room.name);
    if (loc?.shelf?.rack?.code) locationChain.push(`Rack ${loc.shelf.rack.code}`);
    if (loc?.name) locationChain.push(loc.name);

    const movementHistory = (file.refileEvents ?? []).map((ev: any) => ({
      id: ev.id,
      eventType: 'REFILED',
      fromLocation: null,
      toLocation: null,
      timestamp: ev.scannedAt ? ev.scannedAt.toISOString() : new Date().toISOString(),
      performedBy: ev.operatorId ?? 'Operator',
      notes: ev.action ?? null
    }));

    const fileDetail = {
      id: file.id,
      barcode: file.barcode,
      title: file.title ?? file.barcode,
      parentBox: {
        id: file.box?.id ?? '',
        barcode: file.box?.barcode ?? 'Unassigned',
        name: file.box?.description ?? null,
        location: file.box?.currentLocation?.name ?? 'Unassigned'
      },
      locationChain: locationChain.length > 0 ? locationChain : ['Warehouse Location'],
      status: file.status,
      movementHistory,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt ? file.updatedAt.toISOString() : null
    };

    res.status(200).json({ success: true, data: fileDetail });
  } catch (error) {
    next(error);
  }
});

// POST /search/boxes/:id/files and /boxes/:id/files -> insert file into box
router.post(['/search/boxes/:id/files', '/boxes/:id/files'], async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.id;
    const deviceId = (req.headers['x-device-id'] as string) || (req as any).deviceId || null;
    const boxId = String(req.params.id);
    const { fileBarcode, title } = req.body ?? {};

    const cleanFileBarcode = fileBarcode ? String(fileBarcode).trim().toUpperCase() : '';
    if (!cleanFileBarcode) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'File barcode is required' } });
    }

    // Resolve target Box by ID or barcode
    const box = await prisma.box.findFirst({
      where: {
        companyId,
        OR: [{ id: boxId }, { barcode: boxId }]
      },
      include: {
        currentLocation: {
          include: {
            shelf: { include: { rack: { include: { room: { include: { warehouse: true } } } } } }
          }
        }
      }
    });

    if (!box) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Box not found' } });
    }

    if (box.status !== 'ACTIVE') {
      return res.status(422).json({
        success: false,
        error: { code: 'BOX_INACTIVE', message: `Box is in ${box.status} state and cannot accept new files.` }
      });
    }

    // Check if file already exists in database
    let file = await prisma.fileRecord.findFirst({
      where: { companyId, barcode: cleanFileBarcode },
      include: { box: true }
    });

    if (file) {
      if (file.boxId) {
        if (file.boxId === box.id) {
          return res.status(409).json({
            success: false,
            error: { code: 'DUPLICATE', message: `File '${cleanFileBarcode}' is already assigned to this Box (${box.barcode}).` }
          });
        } else {
          return res.status(409).json({
            success: false,
            error: { code: 'ALREADY_ASSIGNED', message: `File '${cleanFileBarcode}' is already assigned to Box '${file.box?.barcode || file.boxId}'.` }
          });
        }
      }

      file = await prisma.fileRecord.update({
        where: { id: file.id },
        data: {
          boxId: box.id,
          status: 'ACTIVE'
        },
        include: { box: true }
      });

      await AuditService.recordAuditLog({
        companyId,
        userId,
        action: 'FILE_RECORD_UPDATED',
        entityType: 'FILE_RECORD',
        entityId: file.id,
        fileRecordId: file.id,
        boxId: box.id,
        locationId: box.currentLocationId,
        warehouseId: box.currentLocation?.shelf?.rack?.room?.warehouse?.id || null,
        deviceId,
        previousState: { boxId: null },
        newState: {
          action: 'FILE_INSERTED_IN_BOX',
          fileBarcode: file.barcode,
          boxBarcode: box.barcode,
          boxId: box.id
        }
      });
    } else {
      file = await FileRecordService.createFileRecord(
        companyId,
        box.id,
        cleanFileBarcode,
        title || `File ${cleanFileBarcode}`,
        'ACTIVE',
        userId,
        deviceId
      );
    }

    if (!file) {
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create or update file record' } });
    }

    const updatedCount = await prisma.fileRecord.count({
      where: { boxId: box.id, status: 'ACTIVE' }
    });

    res.status(200).json({
      success: true,
      data: {
        id: file.id,
        barcode: file.barcode,
        title: (file as any).title ?? file.barcode,
        boxId: box.id,
        boxBarcode: box.barcode,
        filesCount: updatedCount
      },
      message: `File ${file.barcode} inserted into Box ${box.barcode} successfully`
    });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code || 'ERROR', message: error.message }
      });
    }
    next(error);
  }
});

export default router;
