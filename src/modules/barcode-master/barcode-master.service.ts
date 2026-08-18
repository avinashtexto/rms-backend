import { prisma } from '../../lib/prisma';
import { BarcodeType, BarcodeStatus } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCode } from '../../lib/error-codes';

export interface ListBarcodesQuery {
  companyId?: string;
  siteId?: string;
  branchId?: string;
  warehouseId?: string;
  type?: BarcodeType;
  status?: BarcodeStatus;
  isAssigned?: boolean | string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface BulkGenerateParams {
  companyId: string;
  siteId?: string;
  branchId?: string;
  warehouseId?: string;
  type: BarcodeType;
  prefix: string;
  startingNumber: number;
  quantity: number;
  remarks?: string;
}

export interface ImportBarcodeRow {
  barcode: string;
  type: BarcodeType;
  status?: BarcodeStatus;
  siteCode?: string;
  branchCode?: string;
  warehouseCode?: string;
  remarks?: string;
}

export class BarcodeMasterService {
  /**
   * Dashboard Summary Statistics
   */
  static async getDashboardStats(companyId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      total,
      boxMasterCount,
      realBoxCount,
      fileCount,
      locationCount,
      assignedCount,
      unassignedCount,
      inactiveCount,
      todayGenerated
    ] = await Promise.all([
      prisma.barcodeMaster.count({ where: { companyId } }),
      prisma.barcodeMaster.count({ where: { companyId, type: BarcodeType.BOX } }),
      prisma.box.count({ where: { companyId } }),
      prisma.fileRecord.count({ where: { companyId } }),
      prisma.barcodeMaster.count({ where: { companyId, type: BarcodeType.LOCATION } }),
      prisma.barcodeMaster.count({ where: { companyId, isAssigned: true } }),
      prisma.barcodeMaster.count({ where: { companyId, status: BarcodeStatus.UNASSIGNED } }),
      prisma.barcodeMaster.count({ where: { companyId, status: BarcodeStatus.INACTIVE } }),
      prisma.barcodeMaster.count({ where: { companyId, createdAt: { gte: todayStart } } })
    ]);

    const finalBoxCount = Math.max(realBoxCount, boxMasterCount);

    return {
      total,
      boxCount: finalBoxCount,
      fileCount,
      locationCount,
      assignedCount,
      unassignedCount,
      inactiveCount,
      todayGenerated
    };
  }

  /**
   * Automatically generate the next sequential Box barcode (BX + 6 digits).
   * Scans both Box and BarcodeMaster tables to guarantee global uniqueness.
   */
  static async generateNextBoxBarcode(tx?: any): Promise<string> {
    const client = tx || prisma;

    // Fetch the most recent barcodes matching BX prefix from both tables
    const [recentBoxes, recentMasters] = await Promise.all([
      client.box.findMany({
        where: { barcode: { startsWith: 'BX' } },
        select: { barcode: true },
        take: 200,
        orderBy: { barcode: 'desc' }
      }),
      client.barcodeMaster.findMany({
        where: { barcode: { startsWith: 'BX' } },
        select: { barcode: true },
        take: 200,
        orderBy: { barcode: 'desc' }
      })
    ]);

    let maxSequence = 0;
    const regex = /^BX(\d+)$/i;

    for (const b of recentBoxes) {
      const match = b.barcode.match(regex);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxSequence) maxSequence = val;
      }
    }

    for (const m of recentMasters) {
      const match = m.barcode.match(regex);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxSequence) maxSequence = val;
      }
    }

    // Default start sequence if no BX numbers exist yet
    let candidateSeq = maxSequence > 0 ? maxSequence + 1 : 171524;

    // Collision avoidance loop
    while (true) {
      const candidate = `BX${String(candidateSeq).padStart(6, '0')}`;
      const [inBox, inMaster] = await Promise.all([
        client.box.findUnique({ where: { barcode: candidate } }),
        client.barcodeMaster.findUnique({ where: { barcode: candidate } })
      ]);

      if (!inBox && !inMaster) {
        return candidate;
      }
      candidateSeq++;
    }
  }

  /**
   * Automatically generate the next sequential File code/barcode (MAC + 7 digits).
   * Scans both FileRecord and BarcodeMaster tables to guarantee global uniqueness.
   */
  static async generateNextFileCode(tx?: any): Promise<string> {
    const client = tx || prisma;

    const [recentFiles, recentMasters] = await Promise.all([
      client.fileRecord.findMany({
        where: { barcode: { startsWith: 'MAC' } },
        select: { barcode: true },
        take: 200,
        orderBy: { barcode: 'desc' }
      }),
      client.barcodeMaster.findMany({
        where: { barcode: { startsWith: 'MAC' } },
        select: { barcode: true },
        take: 200,
        orderBy: { barcode: 'desc' }
      })
    ]);

    let maxSequence = 0;
    const regex = /^MAC(\d+)$/i;

    for (const f of recentFiles) {
      const match = f.barcode.match(regex);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxSequence) maxSequence = val;
      }
    }

    for (const m of recentMasters) {
      const match = m.barcode.match(regex);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxSequence) maxSequence = val;
      }
    }

    // Default start sequence if no MAC numbers exist yet
    let candidateSeq = maxSequence > 0 ? maxSequence + 1 : 5832438;

    // Collision avoidance loop
    while (true) {
      const candidate = `MAC${String(candidateSeq).padStart(7, '0')}`;
      const [inFile, inMaster] = await Promise.all([
        client.fileRecord.findUnique({ where: { barcode: candidate } }),
        client.barcodeMaster.findUnique({ where: { barcode: candidate } })
      ]);

      if (!inFile && !inMaster) {
        return candidate;
      }
      candidateSeq++;
    }
  }

  /**
   * Create single barcode
   */
  static async create(data: {
    companyId: string;
    siteId?: string;
    branchId?: string;
    warehouseId?: string;
    barcode?: string;
    type: BarcodeType;
    status?: BarcodeStatus;
    remarks?: string;
  }, userId: string) {
    let cleanBarcode = data.barcode ? data.barcode.trim().toUpperCase() : '';

    if (!cleanBarcode && data.type === BarcodeType.BOX) {
      cleanBarcode = await this.generateNextBoxBarcode();
    } else if (!cleanBarcode && data.type === BarcodeType.FILE_RECORD) {
      cleanBarcode = await this.generateNextFileCode();
    } else if (!cleanBarcode) {
      const err: AppError = new Error('Barcode is required.');
      err.statusCode = 400;
      err.code = ErrorCode.VALIDATION_ERROR;
      throw err;
    }

    // Check duplicate
    const existing = await prisma.barcodeMaster.findUnique({
      where: { barcode: cleanBarcode }
    });

    if (existing) {
      const err: AppError = new Error('Barcode already exists.');
      err.statusCode = 400;
      err.code = ErrorCode.DUPLICATE_CODE;
      throw err;
    }

    // Check if object already exists in database
    let isAssigned = false;
    let assignedToType: string | undefined;
    let assignedToId: string | undefined;

    if (data.type === BarcodeType.BOX) {
      const box = await prisma.box.findUnique({ where: { barcode: cleanBarcode } });
      if (box) {
        isAssigned = true;
        assignedToType = 'BOX';
        assignedToId = box.id;
      }
    } else if (data.type === BarcodeType.FILE_RECORD) {
      const file = await prisma.fileRecord.findUnique({ where: { barcode: cleanBarcode } });
      if (file) {
        isAssigned = true;
        assignedToType = 'FILE_RECORD';
        assignedToId = file.id;
      }
    } else if (data.type === BarcodeType.LOCATION) {
      const loc = await prisma.location.findUnique({ where: { barcode: cleanBarcode } });
      if (loc) {
        isAssigned = true;
        assignedToType = 'LOCATION';
        assignedToId = loc.id;
      }
    }

    const initialStatus = isAssigned ? BarcodeStatus.ASSIGNED : (data.status || BarcodeStatus.UNASSIGNED);

    const siteId = data.siteId && data.siteId.trim() ? data.siteId.trim() : undefined;
    const branchId = data.branchId && data.branchId.trim() ? data.branchId.trim() : undefined;
    const warehouseId = data.warehouseId && data.warehouseId.trim() ? data.warehouseId.trim() : undefined;

    const barcodeObj = await prisma.barcodeMaster.create({
      data: {
        companyId: data.companyId,
        siteId,
        branchId,
        warehouseId,
        barcode: cleanBarcode,
        type: data.type,
        status: initialStatus,
        isAssigned,
        assignedToType,
        assignedToId,
        assignedAt: isAssigned ? new Date() : undefined,
        createdById: userId,
        remarks: data.remarks
      },
      include: {
        site: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, fullName: true, email: true } }
      }
    });

    // Record history log
    await prisma.barcodeHistory.create({
      data: {
        barcodeMasterId: barcodeObj.id,
        barcode: cleanBarcode,
        action: 'CREATED',
        newStatus: initialStatus,
        userId,
        remarks: data.remarks || 'Barcode created'
      }
    });

    return barcodeObj;
  }

  /**
   * List Barcodes with Pagination & Filters
   */
  static async list(query: ListBarcodesQuery) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.companyId) where.companyId = query.companyId;
    if (query.siteId) where.siteId = query.siteId;
    if (query.branchId) where.branchId = query.branchId;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.isAssigned !== undefined && query.isAssigned !== null) {
      where.isAssigned = String(query.isAssigned) === 'true';
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    if (query.search) {
      const term = query.search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { barcode: { contains: term, mode: 'insensitive' } },
            { remarks: { contains: term, mode: 'insensitive' } },
            { assignedToType: { contains: term, mode: 'insensitive' } },
            { assignedToId: { contains: term, mode: 'insensitive' } },
          ]
        }
      ];
    }

    const [total, data] = await Promise.all([
      prisma.barcodeMaster.count({ where }),
      prisma.barcodeMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true, code: true } },
          site: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, fullName: true, email: true } }
        }
      })
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single barcode details & history timeline
   */
  static async getById(idOrBarcode: string) {
    const barcodeObj = await prisma.barcodeMaster.findFirst({
      where: {
        OR: [
          { id: idOrBarcode },
          { barcode: idOrBarcode }
        ]
      },
      include: {
        company: { select: { id: true, name: true, code: true } },
        site: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        history: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, fullName: true, email: true } }
          }
        }
      }
    });

    if (barcodeObj) {
      return barcodeObj;
    }

    // Fallback 1: Check Box by ID or Barcode
    const box = await prisma.box.findFirst({
      where: { OR: [{ id: idOrBarcode }, { barcode: idOrBarcode }] },
      include: { client: true, department: true }
    });

    if (box) {
      return {
        id: box.id,
        barcode: box.barcode,
        type: 'BOX',
        status: box.status || 'ASSIGNED',
        isAssigned: true,
        assignedToType: 'BOX',
        assignedToId: box.id,
        remarks: box.description,
        createdAt: box.createdAt,
        history: []
      };
    }

    // Fallback 2: Check FileRecord by ID or Barcode
    const file = await prisma.fileRecord.findFirst({
      where: { OR: [{ id: idOrBarcode }, { barcode: idOrBarcode }] }
    });

    if (file) {
      return {
        id: file.id,
        barcode: file.barcode,
        type: 'FILE',
        status: file.status || 'ASSIGNED',
        isAssigned: true,
        assignedToType: 'FILE',
        assignedToId: file.id,
        remarks: file.title,
        createdAt: file.createdAt,
        history: []
      };
    }

    const err: AppError = new Error('Barcode not found');
    err.statusCode = 404;
    err.code = ErrorCode.NOT_FOUND;
    throw err;
  }

  /**
   * Update barcode
   */
  static async update(id: string, data: {
    status?: BarcodeStatus;
    siteId?: string | null;
    branchId?: string | null;
    warehouseId?: string | null;
    isAssigned?: boolean;
    assignedToType?: string | null;
    assignedToId?: string | null;
    remarks?: string | null;
  }, userId: string) {
    const existing = await prisma.barcodeMaster.findUnique({ where: { id } });

    if (!existing) {
      const err: AppError = new Error('Barcode not found');
      err.statusCode = 404;
      err.code = ErrorCode.NOT_FOUND;
      throw err;
    }

    const siteId = data.siteId !== undefined ? (data.siteId && typeof data.siteId === 'string' && data.siteId.trim() ? data.siteId.trim() : null) : existing.siteId;
    const branchId = data.branchId !== undefined ? (data.branchId && typeof data.branchId === 'string' && data.branchId.trim() ? data.branchId.trim() : null) : existing.branchId;
    const warehouseId = data.warehouseId !== undefined ? (data.warehouseId && typeof data.warehouseId === 'string' && data.warehouseId.trim() ? data.warehouseId.trim() : null) : existing.warehouseId;
    const isAssigned = data.isAssigned !== undefined ? Boolean(data.isAssigned) : existing.isAssigned;
    const assignedToType = data.assignedToType !== undefined ? (data.assignedToType && typeof data.assignedToType === 'string' && data.assignedToType.trim() ? data.assignedToType.trim() : null) : existing.assignedToType;
    const assignedToId = data.assignedToId !== undefined ? (data.assignedToId && typeof data.assignedToId === 'string' && data.assignedToId.trim() ? data.assignedToId.trim() : null) : existing.assignedToId;

    const updated = await prisma.barcodeMaster.update({
      where: { id },
      data: {
        status: data.status || existing.status,
        siteId,
        branchId,
        warehouseId,
        isAssigned,
        assignedToType,
        assignedToId,
        assignedAt: isAssigned ? (existing.assignedAt || new Date()) : null,
        remarks: data.remarks !== undefined ? data.remarks : existing.remarks
      },
      include: {
        site: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } }
      }
    });

    // Record history
    await prisma.barcodeHistory.create({
      data: {
        barcodeMasterId: existing.id,
        barcode: existing.barcode,
        action: 'UPDATED',
        previousStatus: existing.status,
        newStatus: updated.status,
        userId,
        remarks: data.remarks || 'Barcode updated'
      }
    });

    return updated;
  }

  /**
   * Delete barcode
   */
  static async delete(id: string, companyId: string, userId: string) {
    const existing = await prisma.barcodeMaster.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      const err: AppError = new Error('Barcode not found or access denied.');
      err.statusCode = 404;
      err.code = ErrorCode.NOT_FOUND;
      throw err;
    }

    // Check if an actual active Box, FileRecord, or Location is currently using this barcode
    const [assignedBox, assignedFile, assignedLocation] = await Promise.all([
      prisma.box.findFirst({ where: { barcode: existing.barcode, companyId } }),
      prisma.fileRecord.findFirst({ where: { barcode: existing.barcode, companyId } }),
      prisma.location.findFirst({
        where: {
          barcode: existing.barcode,
          shelf: { rack: { room: { warehouse: { companyId } } } }
        }
      })
    ]);

    if (assignedBox || assignedFile || assignedLocation) {
      // If it is genuinely attached to a live record, prevent accidental deletion
      await prisma.barcodeMaster.update({
        where: { id: existing.id },
        data: {
          isAssigned: true,
          status: BarcodeStatus.ASSIGNED,
          assignedToType: assignedBox ? 'BOX' : assignedFile ? 'FILE_RECORD' : 'LOCATION',
          assignedToId: assignedBox?.id || assignedFile?.id || assignedLocation?.id
        }
      });
      const targetName = assignedBox ? `Box (${assignedBox.barcode})` : assignedFile ? `File (${assignedFile.barcode})` : `Location (${assignedLocation?.barcode})`;
      const err: AppError = new Error(`Barcode is currently assigned to ${targetName} and cannot be deleted until the record is deleted.`);
      err.statusCode = 400;
      err.code = ErrorCode.BAD_REQUEST;
      throw err;
    }

    // Clean any foreign key barcode history references first
    await prisma.barcodeHistory.deleteMany({
      where: { barcodeMasterId: existing.id }
    });

    await prisma.barcodeMaster.delete({ where: { id: existing.id } });
    return { success: true, message: 'Barcode deleted successfully.' };
  }

  /**
   * Bulk Auto-Generation of Barcodes
   */
  static async bulkGenerate(params: BulkGenerateParams, userId: string) {
    const { companyId, type, prefix, startingNumber, quantity, remarks } = params;
    const siteId = params.siteId && params.siteId.trim() ? params.siteId.trim() : undefined;
    const branchId = params.branchId && params.branchId.trim() ? params.branchId.trim() : undefined;
    const warehouseId = params.warehouseId && params.warehouseId.trim() ? params.warehouseId.trim() : undefined;

    if (quantity < 1 || quantity > 10000) {
      const err: AppError = new Error('Quantity must be between 1 and 10,000');
      err.statusCode = 400;
      err.code = ErrorCode.VALIDATION_ERROR;
      throw err;
    }

    const createdBarcodes: string[] = [];
    const skippedBarcodes: string[] = [];

    // Calculate number padding (e.g. starting number 1 with quantity 100 -> 6 digits padding)
    const padLength = Math.max(6, String(startingNumber + quantity).length);

    const barcodeItemsToCreate: any[] = [];

    for (let i = 0; i < quantity; i++) {
      const numStr = String(startingNumber + i).padStart(padLength, '0');
      const barcodeStr = `${prefix.trim().toUpperCase()}${numStr}`;

      barcodeItemsToCreate.push({
        companyId,
        siteId,
        branchId,
        warehouseId,
        barcode: barcodeStr,
        type,
        status: BarcodeStatus.UNASSIGNED,
        isAssigned: false,
        createdById: userId,
        remarks: remarks || `Auto-generated sequence`
      });
    }

    // Filter out duplicates in single query
    const generatedStrings = barcodeItemsToCreate.map(b => b.barcode);
    const existingInDb = await prisma.barcodeMaster.findMany({
      where: { barcode: { in: generatedStrings } },
      select: { barcode: true }
    });
    const existingSet = new Set(existingInDb.map(e => e.barcode));

    const finalToCreate = barcodeItemsToCreate.filter(b => {
      if (existingSet.has(b.barcode)) {
        skippedBarcodes.push(b.barcode);
        return false;
      }
      createdBarcodes.push(b.barcode);
      return true;
    });

    if (finalToCreate.length > 0) {
      await prisma.barcodeMaster.createMany({
        data: finalToCreate,
        skipDuplicates: true
      });

      // Fetch created items to generate history records
      const createdItems = await prisma.barcodeMaster.findMany({
        where: { barcode: { in: createdBarcodes } },
        select: { id: true, barcode: true }
      });

      const historyData = createdItems.map(item => ({
        barcodeMasterId: item.id,
        barcode: item.barcode,
        action: 'GENERATED',
        newStatus: BarcodeStatus.UNASSIGNED,
        userId,
        remarks: `Bulk generated with prefix ${prefix}`
      }));

      await prisma.barcodeHistory.createMany({ data: historyData });
    }

    return {
      totalRequested: quantity,
      totalCreated: createdBarcodes.length,
      totalSkipped: skippedBarcodes.length,
      createdBarcodes: createdBarcodes.slice(0, 50),
      skippedBarcodes: skippedBarcodes.slice(0, 50)
    };
  }

  /**
   * Import CSV/Excel rows
   */
  static async importBarcodes(rows: ImportBarcodeRow[], companyId: string, userId: string) {
    let createdCount = 0;
    let skippedCount = 0;
    const errors: Array<{ row: number; barcode: string; reason: string }> = [];

    // Pre-fetch site, branch, warehouse mapping by code for efficiency
    const [sites, branches, warehouses] = await Promise.all([
      prisma.site.findMany({ where: { companyId }, select: { id: true, code: true } }),
      prisma.branch.findMany({ where: { companyId }, select: { id: true, code: true } }),
      prisma.warehouse.findMany({ where: { companyId }, select: { id: true, code: true } })
    ]);

    const siteMap = new Map(sites.map(s => [s.code.toUpperCase(), s.id]));
    const branchMap = new Map(branches.map(b => [b.code.toUpperCase(), b.id]));
    const warehouseMap = new Map(warehouses.map(w => [w.code.toUpperCase(), w.id]));

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rawBarcode = (row.barcode || '').trim().toUpperCase();

      if (!rawBarcode) {
        errors.push({ row: index + 1, barcode: '', reason: 'Barcode value missing' });
        continue;
      }

      if (!row.type || !Object.values(BarcodeType).includes(row.type)) {
        errors.push({ row: index + 1, barcode: rawBarcode, reason: `Invalid Barcode Type. Allowed: LOCATION, BOX, FILE_RECORD` });
        continue;
      }

      const siteId = row.siteCode ? siteMap.get(row.siteCode.trim().toUpperCase()) : undefined;
      const branchId = row.branchCode ? branchMap.get(row.branchCode.trim().toUpperCase()) : undefined;
      const warehouseId = row.warehouseCode ? warehouseMap.get(row.warehouseCode.trim().toUpperCase()) : undefined;

      try {
        await this.create({
          companyId,
          siteId,
          branchId,
          warehouseId,
          barcode: rawBarcode,
          type: row.type,
          status: row.status || BarcodeStatus.UNASSIGNED,
          remarks: row.remarks || 'Imported via CSV/Excel'
        }, userId);
        createdCount++;
      } catch (err: any) {
        if (err.code === ErrorCode.DUPLICATE_CODE || err.message?.includes('already exists')) {
          skippedCount++;
        } else {
          errors.push({ row: index + 1, barcode: rawBarcode, reason: err.message || 'Error creating barcode' });
        }
      }
    }

    return {
      totalRows: rows.length,
      createdCount,
      skippedCount,
      errorCount: errors.length,
      errors
    };
  }

  /**
   * Bulk actions (activate, deactivate, delete)
   */
  static async bulkAction(ids: string[], action: 'ACTIVATE' | 'DEACTIVATE' | 'DELETE', userId: string) {
    if (!ids || ids.length === 0) {
      return { count: 0 };
    }

    if (action === 'DELETE') {
      const result = await prisma.barcodeMaster.deleteMany({
        where: {
          id: { in: ids },
          isAssigned: false
        }
      });
      return { count: result.count };
    }

    const newStatus = action === 'ACTIVATE' ? BarcodeStatus.UNASSIGNED : BarcodeStatus.INACTIVE;

    const barcodes = await prisma.barcodeMaster.findMany({
      where: { id: { in: ids } },
      select: { id: true, barcode: true, status: true }
    });

    await prisma.barcodeMaster.updateMany({
      where: { id: { in: ids } },
      data: { status: newStatus }
    });

    // Write history
    const historyLogs = barcodes.map(b => ({
      barcodeMasterId: b.id,
      barcode: b.barcode,
      action: action === 'ACTIVATE' ? 'ACTIVATED' : 'DEACTIVATED',
      previousStatus: b.status,
      newStatus,
      userId,
      remarks: `Bulk ${action.toLowerCase()} action`
    }));

    await prisma.barcodeHistory.createMany({ data: historyLogs });

    return { count: barcodes.length };
  }

  /**
   * Bulk assign barcodes to a warehouse / site / branch
   */
  static async bulkAssign(
    ids: string[],
    data: { warehouseId?: string | null; siteId?: string | null; branchId?: string | null },
    userId: string
  ) {
    if (!ids || ids.length === 0) return { count: 0 };

    const barcodes = await prisma.barcodeMaster.findMany({
      where: { id: { in: ids } },
      select: { id: true, barcode: true, status: true }
    });

    await prisma.barcodeMaster.updateMany({
      where: { id: { in: ids } },
      data: {
        warehouseId: data.warehouseId ?? null,
        siteId: data.siteId ?? null,
        branchId: data.branchId ?? null,
      }
    });

    const historyLogs = barcodes.map(b => ({
      barcodeMasterId: b.id,
      barcode: b.barcode,
      action: 'UPDATED',
      previousStatus: b.status,
      newStatus: b.status,
      userId,
      remarks: `Bulk assigned to warehouse/site/branch`
    }));
    await prisma.barcodeHistory.createMany({ data: historyLogs });

    return { count: barcodes.length };
  }

  /**
   * Print Barcode Labels Payload
   */
  static async printBarcodes(ids: string[], userId: string) {
    if (!Array.isArray(ids) || ids.length === 0) {
      const err: AppError = new Error('No barcodes provided for printing.');
      err.statusCode = 400;
      err.code = ErrorCode.VALIDATION_ERROR;
      throw err;
    }

    // 1. First find directly in BarcodeMaster by ID or barcode
    let barcodes = await prisma.barcodeMaster.findMany({
      where: {
        OR: [
          { id: { in: ids } },
          { barcode: { in: ids } }
        ]
      },
      include: {
        company: { select: { name: true } },
        site: { select: { name: true, code: true } },
        warehouse: { select: { name: true, code: true } }
      }
    });

    const foundBarcodeStrings = new Set(barcodes.map(b => b.barcode));
    const foundIds = new Set(barcodes.map(b => b.id));
    const missing = ids.filter(id => !foundIds.has(id) && !foundBarcodeStrings.has(id));

    // 2. If any IDs were Box IDs or FileRecord IDs, look up their physical records
    if (missing.length > 0) {
      const [boxes, fileRecords] = await Promise.all([
        prisma.box.findMany({
          where: {
            OR: [
              { id: { in: missing } },
              { barcode: { in: missing } }
            ]
          },
          include: {
            client: { select: { name: true } },
            currentLocation: {
              include: {
                shelf: {
                  include: {
                    rack: {
                      include: {
                        room: {
                          include: {
                            warehouse: { select: { name: true, code: true } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }),
        prisma.fileRecord.findMany({
          where: {
            OR: [
              { id: { in: missing } },
              { barcode: { in: missing } }
            ]
          },
          include: {
            box: {
              include: {
                client: { select: { name: true } }
              }
            }
          }
        })
      ]);

      const extraLabelsFromBoxes = boxes.map(b => ({
        id: b.id,
        barcode: b.barcode,
        type: 'BOX' as BarcodeType,
        status: 'ASSIGNED' as BarcodeStatus,
        company: b.client?.name || 'RMS',
        site: '',
        warehouse: b.currentLocation?.shelf?.rack?.room?.warehouse?.name || '',
        zpl: `^XA^FO50,50^BY2^BCN,100,Y,N,N^FD${b.barcode}^FS^XZ`
      }));

      const extraLabelsFromFiles = fileRecords.map(f => ({
        id: f.id,
        barcode: f.barcode,
        type: 'FILE_RECORD' as BarcodeType,
        status: 'ASSIGNED' as BarcodeStatus,
        company: f.box?.client?.name || 'RMS',
        site: '',
        warehouse: '',
        zpl: `^XA^FO50,50^BY2^BCN,100,Y,N,N^FD${f.barcode}^FS^XZ`
      }));

      const masterLabels = barcodes.map(b => ({
        id: b.id,
        barcode: b.barcode,
        type: b.type,
        status: b.status,
        company: b.company?.name || 'RMS',
        site: b.site?.name || '',
        warehouse: b.warehouse?.name || '',
        zpl: `^XA^FO50,50^BY2^BCN,100,Y,N,N^FD${b.barcode}^FS^XZ`
      }));

      const combined = [...masterLabels, ...extraLabelsFromBoxes, ...extraLabelsFromFiles];

      if (combined.length === 0) {
        const err: AppError = new Error('No barcodes found for the specified IDs.');
        err.statusCode = 404;
        err.code = ErrorCode.NOT_FOUND;
        throw err;
      }

      // Write print history safely for master barcodes that exist
      if (barcodes.length > 0) {
        const historyLogs = barcodes.map(b => ({
          barcodeMasterId: b.id,
          barcode: b.barcode,
          action: 'PRINTED',
          userId,
          remarks: 'Barcode label printed'
        }));
        await prisma.barcodeHistory.createMany({ data: historyLogs }).catch(() => {});
      }

      return { total: combined.length, labels: combined };
    }

    if (barcodes.length === 0) {
      const err: AppError = new Error('No barcodes found for printing.');
      err.statusCode = 404;
      err.code = ErrorCode.NOT_FOUND;
      throw err;
    }

    // Write print history
    const historyLogs = barcodes.map(b => ({
      barcodeMasterId: b.id,
      barcode: b.barcode,
      action: 'PRINTED',
      userId,
      remarks: 'Barcode label printed'
    }));

    await prisma.barcodeHistory.createMany({ data: historyLogs }).catch(() => {});

    // Generate ZPL & JSON format for printers
    const labels = barcodes.map(b => ({
      id: b.id,
      barcode: b.barcode,
      type: b.type,
      status: b.status,
      company: b.company?.name || 'RMS',
      site: b.site?.name || '',
      warehouse: b.warehouse?.name || '',
      zpl: `^XA^FO50,50^BY2^BCN,100,Y,N,N^FD${b.barcode}^FS^XZ`
    }));

    return { total: labels.length, labels };
  }

  /**
   * Validate Barcode (Scanning API)
   */
  static async validateBarcode(barcode: string, companyId: string, userId?: string) {
    const cleanBarcode = barcode.trim().toUpperCase();

    // Check Company preferences for dynamic barcode registration
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { preferences: true }
    });

    const preferences: any = company?.preferences || {};
    const allowDynamicRegistration = preferences.allowDynamicBarcodeRegistration === true;

    // Check BarcodeMaster
    const master = await prisma.barcodeMaster.findUnique({
      where: { barcode: cleanBarcode },
      include: {
        site: { select: { name: true, code: true } },
        warehouse: { select: { name: true, code: true } }
      }
    });

    if (!master) {
      // Search in physical tables (Box, FileRecord, Location)
      const [box, file, loc] = await Promise.all([
        prisma.box.findUnique({ where: { barcode: cleanBarcode }, include: { currentLocation: true } }),
        prisma.fileRecord.findUnique({ where: { barcode: cleanBarcode }, include: { box: true } }),
        prisma.location.findUnique({ where: { barcode: cleanBarcode }, include: { shelf: { include: { rack: { include: { room: true } } } } } })
      ]);

      if (box || file || loc) {
        let type: BarcodeType = BarcodeType.BOX;
        let object: any = null;

        if (box) {
          type = BarcodeType.BOX;
          object = { id: box.id, barcode: box.barcode, status: box.status, location: box.currentLocation?.name || null };
        } else if (file) {
          type = BarcodeType.FILE_RECORD;
          object = { id: file.id, barcode: file.barcode, status: file.status, boxBarcode: file.box.barcode };
        } else if (loc) {
          type = BarcodeType.LOCATION;
          object = { id: loc.id, barcode: loc.barcode, name: loc.name, isOccupied: loc.isOccupied };
        }

        return {
          valid: true,
          status: 'Barcode Verified',
          exists: true,
          type,
          barcodeStatus: BarcodeStatus.ASSIGNED,
          isAssigned: true,
          object
        };
      }

      if (!allowDynamicRegistration) {
        return {
          valid: false,
          status: 'Barcode Unknown',
          message: 'This barcode is not registered.',
          exists: false
        };
      }

      return {
        valid: true,
        status: 'Unregistered Barcode (Dynamic Allowed)',
        exists: false,
        canRegister: true
      };
    }

    if (master.status === BarcodeStatus.INACTIVE) {
      return {
        valid: false,
        status: 'Barcode Inactive',
        message: 'Barcode inactive.',
        exists: true,
        type: master.type,
        barcodeStatus: master.status
      };
    }

    if (master.isAssigned || master.status === BarcodeStatus.ASSIGNED) {
      return {
        valid: true,
        status: 'Barcode Verified',
        message: 'Barcode already assigned.',
        exists: true,
        type: master.type,
        barcodeStatus: master.status,
        isAssigned: true,
        assignedToType: master.assignedToType,
        assignedToId: master.assignedToId
      };
    }

    return {
      valid: true,
      status: 'Barcode Verified',
      message: 'Barcode is registered and available.',
      exists: true,
      type: master.type,
      barcodeStatus: master.status,
      isAssigned: false
    };
  }
}
