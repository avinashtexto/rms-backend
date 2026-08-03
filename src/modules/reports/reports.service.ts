import {
  OperationType,
  Prisma,
  WorkflowAction
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import {
  ReportDateFilters,
  ReportExportJob,
  ReportExportType,
  ReportsActor,
  SummaryCacheEntry
} from './reports.types';

const REFILE_REJECT_ACTIONS: WorkflowAction[] = [
  WorkflowAction.REFILE_REJECT_WRONG_LOCATION,
  WorkflowAction.REFILE_REJECT_WRONG_BOX
];

const AUDIT_ACTION_BY_TYPE: Partial<Record<OperationType, WorkflowAction>> = {
  [OperationType.FRESH_BOX]: WorkflowAction.FRESH_BOX_MOVE,
  [OperationType.INVENTORY]: WorkflowAction.INVENTORY_VERIFY,
  [OperationType.SEGREGATION]: WorkflowAction.SEGREGATION,
  [OperationType.INTAKE]: WorkflowAction.BOX_CREATED
};

const SUMMARY_CACHE_TTL_MS = 60_000;
const summaryCache = new Map<string, SummaryCacheEntry>();
const exportJobs = new Map<string, ReportExportJob>();

function cacheKey(companyId: string, warehouseId?: string): string {
  return `${companyId}:${warehouseId ?? 'all'}`;
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function warehouseAuditFilter(warehouseId?: string): Prisma.AuditLogWhereInput {
  return warehouseId ? { warehouseId } : {};
}

function warehouseBoxFilter(companyId: string, warehouseId?: string): Prisma.BoxWhereInput {
  if (!warehouseId) {
    return { companyId };
  }

  return {
    companyId,
    currentLocation: {
      shelf: {
        rack: {
          room: { warehouseId }
        }
      }
    }
  };
}

function warehouseLocationWhere(
  companyId: string,
  warehouseId?: string
): Prisma.LocationWhereInput {
  return {
    isActive: true,
    shelf: {
      rack: {
        room: {
          warehouse: {
            companyId,
            ...(warehouseId && { id: warehouseId })
          }
        }
      }
    }
  };
}

function parseDateRange(filters: ReportDateFilters): { from?: Date; to?: Date } {
  return {
    from: filters.from,
    to: filters.to
  };
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];

  for (const row of rows) {
    lines.push(
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || value === undefined) {
            return '';
          }
          const text = String(value).replace(/"/g, '""');
          return `"${text}"`;
        })
        .join(',')
    );
  }

  return lines.join('\n');
}

export class ReportsService {
  static async summary(actor: ReportsActor, warehouseId?: string) {
    const key = cacheKey(actor.companyId, warehouseId);
    const cached = summaryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const todayStart = startOfToday();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const auditWarehouse = warehouseAuditFilter(warehouseId);

    const [
      freshBoxCount,
      inventoryCount,
      segregationCount,
      intakeCount,
      refileCount,
      lookupCount,
      missingFilesCount,
      activeDevicesCount,
      rejectedRefilesCount
    ] = await Promise.all([
      prisma.auditLog.count({
        where: {
          companyId: actor.companyId,
          action: WorkflowAction.FRESH_BOX_MOVE,
          createdAt: { gte: todayStart },
          ...auditWarehouse
        }
      }),
      prisma.auditLog.count({
        where: {
          companyId: actor.companyId,
          action: WorkflowAction.INVENTORY_VERIFY,
          createdAt: { gte: todayStart },
          ...auditWarehouse
        }
      }),
      prisma.auditLog.count({
        where: {
          companyId: actor.companyId,
          action: WorkflowAction.SEGREGATION,
          createdAt: { gte: todayStart },
          ...auditWarehouse
        }
      }),
      prisma.auditLog.count({
        where: {
          companyId: actor.companyId,
          action: WorkflowAction.BOX_CREATED,
          createdAt: { gte: todayStart },
          ...auditWarehouse
        }
      }),
      prisma.refileEvent.count({
        where: {
          fileRecord: { companyId: actor.companyId },
          scannedAt: { gte: todayStart },
          ...(warehouseId && {
            expectedBox: {
              currentLocation: {
                shelf: { rack: { room: { warehouseId } } }
              }
            }
          })
        }
      }),
      Promise.resolve(0),
      prisma.inventoryVerificationScan.count({
        where: {
          isMissingFlag: true,
          fileRecord: {
            companyId: actor.companyId,
            ...(warehouseId && {
              box: warehouseBoxFilter(actor.companyId, warehouseId)
            })
          }
        }
      }),
      prisma.device.count({
        where: {
          companyId: actor.companyId,
          isActive: true,
          lastSeenAt: { gte: twentyFourHoursAgo }
        }
      }),
      prisma.refileEvent.count({
        where: {
          fileRecord: { companyId: actor.companyId },
          action: { in: REFILE_REJECT_ACTIONS },
          scannedAt: { gte: sevenDaysAgo }
        }
      })
    ]);

    const data = {
      todayOperationsByType: {
        [OperationType.FRESH_BOX]: freshBoxCount,
        [OperationType.INVENTORY]: inventoryCount,
        [OperationType.REFILE]: refileCount,
        [OperationType.SEGREGATION]: segregationCount,
        [OperationType.INTAKE]: intakeCount,
        [OperationType.LOOKUP]: lookupCount
      },
      missingFilesCount,
      activeDevicesCount,
      rejectedRefilesCount
    };

    summaryCache.set(key, {
      expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
      data
    });

    return data;
  }

  static async operationsByDay(actor: ReportsActor, filters: ReportDateFilters) {
    const { from, to } = parseDateRange(filters);
    const dateFilter = {
      ...(from && { gte: from }),
      ...(to && { lte: to })
    };
    const auditWarehouse = warehouseAuditFilter(filters.warehouseId);

    const [auditLogs, refileEvents] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          companyId: actor.companyId,
          action: {
            in: [
              WorkflowAction.FRESH_BOX_MOVE,
              WorkflowAction.INVENTORY_VERIFY,
              WorkflowAction.SEGREGATION,
              WorkflowAction.BOX_CREATED
            ]
          },
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
          ...auditWarehouse
        },
        select: { action: true, createdAt: true }
      }),
      prisma.refileEvent.findMany({
        where: {
          fileRecord: { companyId: actor.companyId },
          ...(Object.keys(dateFilter).length > 0 && { scannedAt: dateFilter }),
          ...(filters.warehouseId && {
            expectedBox: {
              currentLocation: {
                shelf: { rack: { room: { warehouseId: filters.warehouseId } } }
              }
            }
          })
        },
        select: { scannedAt: true }
      })
    ]);

    const buckets = new Map<string, Record<OperationType, number>>();

    const bump = (dateKey: string, type: OperationType) => {
      const current = buckets.get(dateKey) ?? {
        [OperationType.FRESH_BOX]: 0,
        [OperationType.INVENTORY]: 0,
        [OperationType.REFILE]: 0,
        [OperationType.SEGREGATION]: 0,
        [OperationType.INTAKE]: 0,
        [OperationType.LOOKUP]: 0
      };
      current[type] += 1;
      buckets.set(dateKey, current);
    };

    for (const log of auditLogs) {
      const dateKey = log.createdAt.toISOString().slice(0, 10);
      const typeEntry = Object.entries(AUDIT_ACTION_BY_TYPE).find(([, action]) => action === log.action);
      if (typeEntry) {
        bump(dateKey, typeEntry[0] as OperationType);
      }
    }

    for (const event of refileEvents) {
      bump(event.scannedAt.toISOString().slice(0, 10), OperationType.REFILE);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, counts }));
  }

  static async productivity(actor: ReportsActor, filters: ReportDateFilters) {
    const { from, to } = parseDateRange(filters);
    const dateFilter = {
      ...(from && { gte: from }),
      ...(to && { lte: to })
    };

    const [freshScans, inventoryScans, refiles] = await Promise.all([
      prisma.freshBoxMoveScan.findMany({
        where: {
          session: {
            operator: { companyId: actor.companyId }
          },
          ...(filters.warehouseId && {
            location: {
              shelf: { rack: { room: { warehouseId: filters.warehouseId } } }
            }
          }),
          ...(Object.keys(dateFilter).length > 0 && { scannedAt: dateFilter })
        },
        select: {
          scannedAt: true,
          session: {
            select: {
              operator: { select: { id: true, fullName: true } }
            }
          }
        }
      }),
      prisma.inventoryVerificationScan.findMany({
        where: {
          session: {
            operator: { companyId: actor.companyId }
          },
          box: warehouseBoxFilter(actor.companyId, filters.warehouseId),
          ...(Object.keys(dateFilter).length > 0 && { scannedAt: dateFilter })
        },
        select: {
          scannedAt: true,
          session: {
            select: {
              operator: { select: { id: true, fullName: true } }
            }
          }
        }
      }),
      prisma.refileEvent.findMany({
        where: {
          fileRecord: { companyId: actor.companyId },
          ...(Object.keys(dateFilter).length > 0 && { scannedAt: dateFilter }),
          ...(filters.warehouseId && {
            expectedBox: {
              currentLocation: {
                shelf: { rack: { room: { warehouseId: filters.warehouseId } } }
              }
            }
          })
        },
        select: {
          scannedAt: true,
          operator: { select: { id: true, fullName: true } }
        }
      })
    ]);

    const buckets = new Map<string, { userId: string; fullName: string; date: string; scanCount: number }>();

    const bump = (userId: string, fullName: string, scannedAt: Date) => {
      const date = scannedAt.toISOString().slice(0, 10);
      const key = `${userId}:${date}`;
      const current = buckets.get(key) ?? { userId, fullName, date, scanCount: 0 };
      current.scanCount += 1;
      buckets.set(key, current);
    };

    for (const scan of freshScans) {
      bump(scan.session.operator.id, scan.session.operator.fullName, scan.scannedAt);
    }
    for (const scan of inventoryScans) {
      bump(scan.session.operator.id, scan.session.operator.fullName, scan.scannedAt);
    }
    for (const event of refiles) {
      bump(event.operator.id, event.operator.fullName, event.scannedAt);
    }

    return Array.from(buckets.values()).sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      return dateCompare !== 0 ? dateCompare : a.fullName.localeCompare(b.fullName);
    });
  }

  static async occupancy(actor: ReportsActor, filters: ReportDateFilters) {
    const locations = await prisma.location.findMany({
      where: warehouseLocationWhere(actor.companyId, filters.warehouseId),
      select: {
        barcode: true,
        isOccupied: true,
        shelf: {
          select: {
            rack: {
              select: {
                room: {
                  select: {
                    warehouse: { select: { code: true } }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { barcode: 'asc' }
    });

    return locations.map((location) => ({
      locationBarcode: location.barcode,
      capacity: 1,
      occupied: location.isOccupied ? 1 : 0,
      warehouseCode: location.shelf.rack.room.warehouse.code
    }));
  }

  static async missingFiles(
    actor: ReportsActor,
    filters: ReportDateFilters & { clientId?: string }
  ) {
    const scans = await prisma.inventoryVerificationScan.findMany({
      where: {
        isMissingFlag: true,
        fileRecord: {
          companyId: actor.companyId,
          ...(filters.clientId && { box: { clientId: filters.clientId } }),
          ...(filters.warehouseId && {
            box: warehouseBoxFilter(actor.companyId, filters.warehouseId)
          })
        }
      },
      include: {
        fileRecord: {
          select: {
            id: true,
            barcode: true,
            box: {
              select: {
                barcode: true,
                currentLocation: { select: { barcode: true, name: true } }
              }
            }
          }
        }
      },
      orderBy: { scannedAt: 'desc' }
    });

    const seen = new Set<string>();
    const rows: Array<{
      fileId: string;
      fileBarcode: string;
      boxBarcode: string;
      lastSeenLocationBarcode: string | null;
      lastSeenLocationName: string | null;
      flaggedAt: Date;
    }> = [];

    for (const scan of scans) {
      if (!scan.fileRecord || seen.has(scan.fileRecord.id)) {
        continue;
      }
      seen.add(scan.fileRecord.id);
      rows.push({
        fileId: scan.fileRecord.id,
        fileBarcode: scan.fileRecord.barcode,
        boxBarcode: scan.fileRecord.box.barcode,
        lastSeenLocationBarcode: scan.fileRecord.box.currentLocation?.barcode ?? null,
        lastSeenLocationName: scan.fileRecord.box.currentLocation?.name ?? null,
        flaggedAt: scan.scannedAt
      });
    }

    return rows;
  }

  static async clientHoldings(actor: ReportsActor, filters: ReportDateFilters) {
    const boxWhere: Prisma.BoxWhereInput = {
      companyId: actor.companyId,
      ...(filters.warehouseId && warehouseBoxFilter(actor.companyId, filters.warehouseId))
    };

    const clients = await prisma.client.findMany({
      where: { companyId: actor.companyId },
      select: {
        id: true,
        code: true,
        name: true,
        _count: {
          select: {
            boxes: { where: boxWhere }
          }
        }
      },
      orderBy: { code: 'asc' }
    });

    const fileCounts = await prisma.fileRecord.groupBy({
      by: ['boxId'],
      where: {
        companyId: actor.companyId,
        status: 'ACTIVE',
        box: boxWhere
      },
      _count: { _all: true }
    });

    const boxClientMap = await prisma.box.findMany({
      where: boxWhere,
      select: { id: true, clientId: true }
    });

    const filesByClient = new Map<string, number>();
    const boxToClient = new Map(boxClientMap.map((box) => [box.id, box.clientId]));

    for (const group of fileCounts) {
      const clientId = boxToClient.get(group.boxId);
      if (!clientId) continue;
      filesByClient.set(clientId, (filesByClient.get(clientId) ?? 0) + group._count._all);
    }

    return clients.map((client) => ({
      clientCode: client.code,
      clientName: client.name,
      boxCount: client._count.boxes,
      fileCount: filesByClient.get(client.id) ?? 0
    }));
  }

  static async export(
    actor: ReportsActor,
    reportType: ReportExportType,
    filters: ReportDateFilters & { clientId?: string }
  ) {
    const jobId = randomUUID();
    const job: ReportExportJob = {
      id: jobId,
      companyId: actor.companyId,
      reportType,
      status: 'PENDING',
      filters,
      createdAt: new Date()
    };

    exportJobs.set(jobId, job);
    setImmediate(() => {
      ReportsService.processExportJob(jobId).catch((error) => {
        const failed = exportJobs.get(jobId);
        if (!failed) return;
        failed.status = 'FAILED';
        failed.error = error instanceof Error ? error.message : 'Export failed';
        failed.completedAt = new Date();
        exportJobs.set(jobId, failed);
      });
    });

    return { jobId };
  }

  static async exportStatus(actor: ReportsActor, jobId: string) {
    const job = exportJobs.get(jobId);
    if (!job || job.companyId !== actor.companyId) {
      const error: AppError = new Error('Export job not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return {
      jobId: job.id,
      reportType: job.reportType,
      status: job.status,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      downloadUrl:
        job.status === 'COMPLETED'
          ? `/api/v1/reports/export/${job.id}/download`
          : undefined
    };
  }

  static async downloadExport(actor: ReportsActor, jobId: string) {
    const job = exportJobs.get(jobId);
    if (!job || job.companyId !== actor.companyId) {
      const error: AppError = new Error('Export job not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    if (job.status === 'PENDING') {
      const error: AppError = new Error('Export is still in progress');
      error.statusCode = 400;
      error.code = ErrorCode.VALIDATION_ERROR;
      throw error;
    }

    if (job.status === 'FAILED') {
      const error: AppError = new Error(job.error ?? 'Export failed');
      error.statusCode = 500;
      error.code = ErrorCode.INTERNAL_SERVER_ERROR;
      throw error;
    }

    return job.csvData ?? '';
  }

  private static async processExportJob(jobId: string) {
    const job = exportJobs.get(jobId);
    if (!job) return;

    const actor = { id: 'system', companyId: job.companyId };
    let rows: Array<Record<string, unknown>> = [];

    switch (job.reportType) {
      case 'OPERATIONS_BY_DAY':
        rows = (await ReportsService.operationsByDay(actor, job.filters)).flatMap((entry) =>
          Object.entries(entry.counts).map(([type, count]) => ({
            date: entry.date,
            type,
            count
          }))
        );
        break;
      case 'PRODUCTIVITY':
        rows = await ReportsService.productivity(actor, job.filters);
        break;
      case 'OCCUPANCY':
        rows = await ReportsService.occupancy(actor, job.filters);
        break;
      case 'MISSING_FILES':
        rows = await ReportsService.missingFiles(actor, job.filters);
        break;
      case 'CLIENT_HOLDINGS':
        rows = await ReportsService.clientHoldings(actor, job.filters);
        break;
      default:
        throw new Error(`Unsupported export type: ${job.reportType}`);
    }

    job.csvData = toCsv(rows);
    job.status = 'COMPLETED';
    job.completedAt = new Date();
    exportJobs.set(jobId, job);
  }
}
