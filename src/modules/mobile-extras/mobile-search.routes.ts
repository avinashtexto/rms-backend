import { Router, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { AuthenticatedRequest } from '../auth/auth.types';
import { prisma } from '../../lib/prisma';
import { AuditService } from '../audit/audit.service';
import { FileRecordService } from '../fileRecord/fileRecord.service';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCode } from '../../lib/error-codes';

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

// GET /search/files/:id and /files/:id -> FileDetailDto
router.get(['/search/files/:id', '/files/:id'], async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const fileId = String(req.params.id);

    let file: any = await prisma.fileRecord.findFirst({
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
      file = await prisma.fileRecord.findFirst({
        where: {
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
    }

    if (!file) {
      let barcodeMaster = await prisma.barcodeMaster.findFirst({
        where: {
          companyId,
          OR: [{ id: fileId }, { barcode: fileId }],
          type: 'FILE_RECORD'
        },
        include: { warehouse: true }
      });

      if (!barcodeMaster) {
        barcodeMaster = await prisma.barcodeMaster.findFirst({
          where: {
            OR: [{ id: fileId }, { barcode: fileId }],
            type: 'FILE_RECORD'
          },
          include: { warehouse: true }
        });
      }

      if (barcodeMaster) {
        return res.status(200).json({
          success: true,
          data: {
            id: barcodeMaster.id,
            barcode: barcodeMaster.barcode,
            title: barcodeMaster.remarks || `File Barcode ${barcodeMaster.barcode}`,
            parentBox: {
              id: '',
              barcode: 'Unassigned',
              name: null,
              location: barcodeMaster.warehouse?.name ?? 'Unassigned'
            },
            locationChain: [barcodeMaster.warehouse?.name ?? 'Warehouse Location'],
            status: barcodeMaster.status,
            movementHistory: [],
            createdAt: barcodeMaster.createdAt.toISOString(),
            updatedAt: barcodeMaster.updatedAt ? barcodeMaster.updatedAt.toISOString() : null
          }
        });
      }
    }

    if (!file) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `File ${fileId} was not found.` } });
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
    const warehouseId = req.user?.warehouseId;
    const deviceId = (req.headers['x-device-id'] as string) || (req as any).deviceId || null;
    const boxId = String(req.params.id);
    const { fileBarcode, title } = req.body ?? {};
    const cleanFileBarcode = fileBarcode ? String(fileBarcode).trim().toUpperCase() : '';
    if (!cleanFileBarcode) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'File barcode is required' } });
    }

    console.log(`[INSERT_FILE_START] boxId=${boxId}, fileBarcode=${cleanFileBarcode}, companyId=${companyId}, warehouseId=${warehouseId}`);

    // 1. Resolve target Box by ID or barcode
    let box = await prisma.box.findFirst({
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
      // Fallback check in BarcodeMaster for pre-generated/registered Box barcodes or IDs
      const masterBox = await prisma.barcodeMaster.findFirst({
        where: {
          companyId,
          OR: [{ id: boxId }, { barcode: boxId }],
          type: 'BOX'
        }
      });

      if (masterBox) {
        if (masterBox.assignedToId) {
          box = await prisma.box.findFirst({
            where: { id: masterBox.assignedToId, companyId },
            include: {
              currentLocation: {
                include: {
                  shelf: { include: { rack: { include: { room: { include: { warehouse: true } } } } } }
                }
              }
            }
          });
        }

        if (!box) {
          // Auto-provision Box entity for pre-registered BarcodeMaster
          const defaultClient = await prisma.client.findFirst({ where: { companyId } });
          if (defaultClient) {
            box = await prisma.box.create({
              data: {
                companyId,
                clientId: defaultClient.id,
                barcode: masterBox.barcode,
                status: 'ACTIVE',
                description: masterBox.remarks || `Barcode Batch ${masterBox.barcode}`
              },
              include: {
                currentLocation: {
                  include: {
                    shelf: { include: { rack: { include: { room: { include: { warehouse: true } } } } } }
                  }
                }
              }
            });

            await prisma.barcodeMaster.update({
              where: { id: masterBox.id },
              data: { isAssigned: true, assignedToType: 'BOX', assignedToId: box.id, assignedAt: new Date() }
            });
          }
        }
      }
    }

    if (!box) {
      console.warn(`[INSERT_FILE_FAILED] BOX_NOT_FOUND: boxId=${boxId}`);
      return res.status(404).json({ success: false, error: { code: 'BOX_NOT_FOUND', message: `Box '${boxId}' not found.` } });
    }

    // Warehouse scope check if user is warehouse-restricted
    if (warehouseId) {
      const boxWarehouseId = box.currentLocation?.shelf?.rack?.room?.warehouse?.id;
      if (boxWarehouseId && boxWarehouseId !== warehouseId) {
        console.warn(`[INSERT_FILE_FAILED] FORBIDDEN: boxWarehouseId=${boxWarehouseId}, userWarehouseId=${warehouseId}`);
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Unauthorized warehouse scope' } });
      }
    }

    if (box.status !== 'ACTIVE') {
      console.warn(`[INSERT_FILE_FAILED] BOX_INACTIVE: boxStatus=${box.status}`);
      return res.status(422).json({
        success: false,
        error: { code: 'BOX_INACTIVE', message: `Box is in ${box.status} state and cannot accept new files.` }
      });
    }

    // 2. Resolve existing FileRecord or BarcodeMaster
    let existingFile = await prisma.fileRecord.findFirst({
      where: { barcode: cleanFileBarcode },
      include: { box: true }
    });

    const existingBarcodeMaster = await prisma.barcodeMaster.findFirst({
      where: { barcode: cleanFileBarcode }
    });

    // File MUST already exist or be registered in BarcodeMaster
    if (!existingFile && !existingBarcodeMaster) {
      console.warn(`[INSERT_FILE_FAILED] BARCODE_UNKNOWN: barcode=${cleanFileBarcode}`);
      return res.status(404).json({
        success: false,
        error: { code: 'BARCODE_UNKNOWN', message: `File barcode '${cleanFileBarcode}' was not found.` }
      });
    }

    // 3. Company Mismatch Check
    const fileCompanyId = existingFile?.companyId || existingBarcodeMaster?.companyId;
    if (fileCompanyId && fileCompanyId !== companyId) {
      console.warn(`[INSERT_FILE_FAILED] COMPANY_MISMATCH: fileCompanyId=${fileCompanyId}, boxCompanyId=${companyId}`);
      return res.status(409).json({
        success: false,
        error: {
          code: 'COMPANY_MISMATCH',
          message: 'File and Box belong to different companies.'
        }
      });
    }

    // 4. Warehouse Mismatch Check
    const boxWarehouseId = box.currentLocation?.shelf?.rack?.room?.warehouse?.id;
    const fileWarehouseId = existingBarcodeMaster?.warehouseId;
    if (boxWarehouseId && fileWarehouseId && boxWarehouseId !== fileWarehouseId) {
      console.warn(`[INSERT_FILE_FAILED] WAREHOUSE_MISMATCH: fileWarehouseId=${fileWarehouseId}, boxWarehouseId=${boxWarehouseId}`);
      return res.status(409).json({
        success: false,
        error: {
          code: 'WAREHOUSE_MISMATCH',
          message: 'File and Box belong to different warehouses.'
        }
      });
    }

    console.log(`[VALIDATION_RESULT] PASSED validation for fileBarcode=${cleanFileBarcode}, targetBoxId=${box.id}`);

    // 5. Check existing assignment
    if (existingFile && existingFile.boxId) {
      if (existingFile.boxId === box.id) {
        console.warn(`[INSERT_FILE_FAILED] FILE_ALREADY_IN_BOX: fileBarcode=${cleanFileBarcode}, boxBarcode=${box.barcode}`);
        return res.status(409).json({
          success: false,
          error: {
            code: 'FILE_ALREADY_IN_BOX',
            message: `File ${cleanFileBarcode} is already inside Box ${box.barcode}.`
          }
        });
      } else {
        console.warn(`[INSERT_FILE_FAILED] FILE_ALREADY_IN_ANOTHER_BOX: fileBarcode=${cleanFileBarcode}, assignedBoxBarcode=${existingFile.box?.barcode}`);
        return res.status(409).json({
          success: false,
          error: {
            code: 'FILE_ALREADY_IN_ANOTHER_BOX',
            message: `File ${cleanFileBarcode} is already assigned to Box ${existingFile.box?.barcode || existingFile.boxId}.`
          }
        });
      }
    }

    // 6. Transactional File Insertion & Audit Log with Capacity Validation
    const maxCapacity = box.capacity || (box.currentLocation as any)?.shelf?.rack?.room?.warehouse?.maxFilesPerBox || 50;

    const resultFile = await prisma.$transaction(async (tx) => {
      // Atomic capacity verification inside transaction to prevent race conditions
      const activeCount = await tx.fileRecord.count({
        where: { boxId: box.id, status: 'ACTIVE' }
      });

      if (activeCount >= maxCapacity) {
        const err: AppError = new Error(`Box ${box.barcode} has reached its maximum capacity of ${maxCapacity} files.`);
        err.statusCode = 409;
        err.code = ErrorCode.BOX_CAPACITY_EXCEEDED;
        throw err;
      }

      let fileObj: any = existingFile;

      if (!fileObj) {
        // Create FileRecord for pre-registered BarcodeMaster
        fileObj = await tx.fileRecord.create({
          data: {
            companyId,
            boxId: box.id,
            barcode: cleanFileBarcode,
            title: title || existingBarcodeMaster?.remarks || `File ${cleanFileBarcode}`,
            status: 'ACTIVE'
          },
          include: { box: true }
        });
      } else {
        fileObj = await tx.fileRecord.update({
          where: { id: fileObj.id },
          data: {
            boxId: box.id,
            status: 'ACTIVE'
          },
          include: { box: true }
        });
      }

      // Sync BarcodeMaster status
      if (existingBarcodeMaster) {
        await tx.barcodeMaster.update({
          where: { id: existingBarcodeMaster.id },
          data: {
            isAssigned: true,
            status: 'ASSIGNED',
            assignedToType: 'FILE_RECORD',
            assignedToId: fileObj.id,
            assignedAt: new Date()
          }
        });
      }

      // Record Audit Log with FILE_INSERTED_IN_BOX action
      await AuditService.recordAuditLog({
        companyId,
        userId,
        action: 'FILE_RECORD_UPDATED',
        entityType: 'FILE_RECORD',
        entityId: fileObj.id,
        fileRecordId: fileObj.id,
        boxId: box.id,
        locationId: box.currentLocationId,
        warehouseId: box.currentLocation?.shelf?.rack?.room?.warehouse?.id || null,
        deviceId,
        previousState: { boxId: null },
        newState: {
          action: 'FILE_INSERTED_IN_BOX',
          fileBarcode: fileObj.barcode,
          boxBarcode: box.barcode,
          boxId: box.id,
          warehouse: box.currentLocation?.shelf?.rack?.room?.warehouse?.name || 'Unassigned',
          company: companyId
        },
        tx
      });

      return fileObj;
    });

    const updatedCount = await prisma.fileRecord.count({
      where: { boxId: box.id, status: 'ACTIVE' }
    });

    res.status(200).json({
      success: true,
      data: {
        id: resultFile.id,
        barcode: resultFile.barcode,
        title: resultFile.title ?? resultFile.barcode,
        boxId: box.id,
        boxBarcode: box.barcode,
        filesCount: updatedCount
      },
      message: `File ${resultFile.barcode} inserted into Box ${box.barcode} successfully`
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

// POST /refile and /search/refile
router.post(['/refile', '/search/refile'], async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.id;
    const warehouseId = req.user!.warehouseId;
    const deviceId = (req.headers['x-device-id'] as string) || (req.headers['x-device-serial'] as string);

    const { fileId, fileBarcode, targetBoxId, targetBoxBarcode, sourceBoxId, sourceBoxBarcode } = req.body ?? {};
    const cleanFileBarcode = fileBarcode ? String(fileBarcode).trim().toUpperCase() : (fileId ? String(fileId).trim().toUpperCase() : '');
    const cleanTargetBoxBarcode = targetBoxBarcode ? String(targetBoxBarcode).trim().toUpperCase() : (targetBoxId ? String(targetBoxId).trim().toUpperCase() : '');

    if (!cleanFileBarcode || !cleanTargetBoxBarcode) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'File barcode and target box barcode are required' }
      });
    }

    console.log(`[REFILE_START] file=${cleanFileBarcode}, targetBox=${cleanTargetBoxBarcode}, companyId=${companyId}`);

    // 1. Resolve File
    let fileObj = await prisma.fileRecord.findFirst({
      where: {
        companyId,
        OR: [{ id: cleanFileBarcode }, { barcode: cleanFileBarcode }]
      },
      include: {
        box: {
          include: {
            currentLocation: {
              include: {
                shelf: { include: { rack: { include: { room: { include: { warehouse: true } } } } } }
              }
            }
          }
        }
      }
    });

    if (!fileObj) {
      console.warn(`[REFILE_FAILED] FILE_NOT_FOUND: ${cleanFileBarcode}`);
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: `File ${cleanFileBarcode} was not found.` }
      });
    }

    const sourceBox = fileObj.box;
    if (!sourceBox) {
      console.warn(`[REFILE_FAILED] SOURCE_BOX_NOT_FOUND for file: ${cleanFileBarcode}`);
      return res.status(404).json({
        success: false,
        error: { code: 'SOURCE_BOX_NOT_FOUND', message: `Current Box for file ${fileObj.barcode} could not be found.` }
      });
    }

    // 2. Resolve Target Box
    let targetBox = await prisma.box.findFirst({
      where: {
        companyId,
        OR: [{ id: cleanTargetBoxBarcode }, { barcode: cleanTargetBoxBarcode }]
      },
      include: {
        currentLocation: {
          include: {
            shelf: { include: { rack: { include: { room: { include: { warehouse: true } } } } } }
          }
        }
      }
    });

    if (!targetBox) {
      const masterBox = await prisma.barcodeMaster.findFirst({
        where: {
          companyId,
          OR: [{ id: cleanTargetBoxBarcode }, { barcode: cleanTargetBoxBarcode }],
          type: 'BOX'
        }
      });

      if (masterBox) {
        if (masterBox.assignedToId) {
          targetBox = await prisma.box.findFirst({
            where: { id: masterBox.assignedToId, companyId },
            include: {
              currentLocation: {
                include: {
                  shelf: { include: { rack: { include: { room: { include: { warehouse: true } } } } } }
                }
              }
            }
          });
        }

        if (!targetBox) {
          const defaultClient = await prisma.client.findFirst({ where: { companyId } });
          if (defaultClient) {
            targetBox = await prisma.box.create({
              data: {
                companyId,
                clientId: defaultClient.id,
                barcode: masterBox.barcode,
                status: 'ACTIVE',
                description: masterBox.remarks || `Barcode Batch ${masterBox.barcode}`
              },
              include: {
                currentLocation: {
                  include: {
                    shelf: { include: { rack: { include: { room: { include: { warehouse: true } } } } } }
                  }
                }
              }
            });

            await prisma.barcodeMaster.update({
              where: { id: masterBox.id },
              data: { isAssigned: true, assignedToType: 'BOX', assignedToId: targetBox.id, assignedAt: new Date() }
            });
          }
        }
      }
    }

    if (!targetBox) {
      console.warn(`[REFILE_FAILED] TARGET_BOX_NOT_FOUND: ${cleanTargetBoxBarcode}`);
      return res.status(404).json({
        success: false,
        error: { code: 'TARGET_BOX_NOT_FOUND', message: `Box ${cleanTargetBoxBarcode} was not found.` }
      });
    }

    // 3. Validate Target Box status and scope
    if (targetBox.status !== 'ACTIVE') {
      console.warn(`[REFILE_FAILED] INACTIVE_BOX: ${targetBox.barcode}`);
      return res.status(422).json({
        success: false,
        error: { code: 'INACTIVE_BOX', message: `Box ${targetBox.barcode} is not active and cannot receive files.` }
      });
    }

    if (warehouseId) {
      const targetWarehouseId = targetBox.currentLocation?.shelf?.rack?.room?.warehouse?.id;
      if (targetWarehouseId && targetWarehouseId !== warehouseId) {
        console.warn(`[REFILE_FAILED] DIFFERENT_WAREHOUSE: targetWarehouseId=${targetWarehouseId}, userWarehouseId=${warehouseId}`);
        return res.status(403).json({
          success: false,
          error: { code: 'DIFFERENT_WAREHOUSE', message: `Target Box ${targetBox.barcode} belongs to a different warehouse.` }
        });
      }
    }

    // 4. Same Box Validation
    if (sourceBox.id === targetBox.id) {
      console.warn(`[REFILE_FAILED] SAME_BOX: file=${fileObj.barcode}, box=${targetBox.barcode}`);
      return res.status(409).json({
        success: false,
        error: { code: 'SAME_BOX', message: `File ${fileObj.barcode} is already inside Box ${targetBox.barcode}.` }
      });
    }

    // 5. Capacity Validation & Transactional Refile
    const maxCapacity = targetBox.capacity || (targetBox.currentLocation as any)?.shelf?.rack?.room?.warehouse?.maxFilesPerBox || 50;

    await prisma.$transaction(async (tx) => {
      const activeCount = await tx.fileRecord.count({
        where: { boxId: targetBox.id, status: 'ACTIVE' }
      });

      if (activeCount >= maxCapacity) {
        const err: AppError = new Error(`Box ${targetBox.barcode} has reached its maximum capacity of ${maxCapacity} files.`);
        err.statusCode = 409;
        err.code = ErrorCode.BOX_CAPACITY_EXCEEDED;
        throw err;
      }

      // Update FileRecord boxId
      await tx.fileRecord.update({
        where: { id: fileObj.id },
        data: {
          boxId: targetBox.id,
          status: 'ACTIVE'
        }
      });

      // Audit Log for Refile
      await AuditService.recordAuditLog({
        companyId,
        userId,
        action: 'FILE_RECORD_UPDATED',
        entityType: 'FILE_RECORD',
        entityId: fileObj.id,
        fileRecordId: fileObj.id,
        boxId: targetBox.id,
        locationId: targetBox.currentLocationId,
        warehouseId: targetBox.currentLocation?.shelf?.rack?.room?.warehouse?.id || null,
        deviceId,
        previousState: {
          boxId: sourceBox.id,
          boxBarcode: sourceBox.barcode
        },
        newState: {
          action: 'FILE_REFILED',
          fileBarcode: fileObj.barcode,
          sourceBoxId: sourceBox.id,
          sourceBoxBarcode: sourceBox.barcode,
          targetBoxId: targetBox.id,
          targetBoxBarcode: targetBox.barcode,
          company: companyId
        },
        tx
      });

      // Create RefileEvent record if locations exist
      if (sourceBox.currentLocationId && targetBox.currentLocationId) {
        try {
          await tx.refileEvent.create({
            data: {
              operatorId: userId,
              fileRecordId: fileObj.id,
              expectedBoxId: sourceBox.id,
              expectedLocationId: sourceBox.currentLocationId,
              scannedLocationId: targetBox.currentLocationId,
              scannedBoxId: targetBox.id,
              action: 'REFILE_SUCCESS',
              clientEventId: `REFILE-${fileObj.id}-${targetBox.id}-${Date.now()}`,
              scannedAt: new Date()
            }
          });
        } catch (e: any) {
          console.warn('[REFILE_EVENT_WARN] Could not create RefileEvent record:', e.message);
        }
      }
    });

    console.log(`[REFILE_SUCCESS] file=${fileObj.barcode}, from=${sourceBox.barcode}, to=${targetBox.barcode}`);

    return res.status(200).json({
      success: true,
      message: 'File refiled successfully',
      data: {
        fileId: fileObj.id,
        fileBarcode: fileObj.barcode,
        sourceBoxId: sourceBox.id,
        sourceBoxBarcode: sourceBox.barcode,
        targetBoxId: targetBox.id,
        targetBoxBarcode: targetBox.barcode
      }
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
