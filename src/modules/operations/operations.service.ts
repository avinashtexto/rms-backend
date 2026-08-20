import {
  OperationType,
  Prisma,
  WorkflowAction
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import {
  ListOperationsQuery,
  OperationStatus,
  OperationSummary,
  OperationsActor
} from './operations.types';

const REFILE_REJECT_ACTIONS: WorkflowAction[] = [
  WorkflowAction.REFILE_REJECT_WRONG_LOCATION,
  WorkflowAction.REFILE_REJECT_WRONG_BOX
];

function auditActionToOperationType(action: WorkflowAction): OperationType | null {
  switch (action) {
    case WorkflowAction.FRESH_BOX_MOVE:
      return OperationType.FRESH_BOX;
    case WorkflowAction.INVENTORY_VERIFY:
      return OperationType.INVENTORY;
    case WorkflowAction.SEGREGATION:
      return OperationType.SEGREGATION;
    case WorkflowAction.BOX_CREATED:
      return OperationType.INTAKE;
    default:
      return null;
  }
}

function refileActionToStatus(action: WorkflowAction): OperationStatus {
  return action === WorkflowAction.REFILE_SUCCESS ? 'COMPLETED' : 'REJECTED';
}

function refileReason(action: WorkflowAction): string | undefined {
  if (action === WorkflowAction.REFILE_REJECT_WRONG_LOCATION) return 'WRONG_LOCATION';
  if (action === WorkflowAction.REFILE_REJECT_WRONG_BOX) return 'WRONG_BOX';
  return undefined;
}

function auditRelationBarcode(log: {
  box?: { barcode: string } | null;
  fileRecord?: { barcode: string } | null;
}): string | undefined {
  return log.box?.barcode ?? log.fileRecord?.barcode;
}

export class OperationsService {
  private static dateFilter(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;
    return {
      ...(from && { gte: from }),
      ...(to && { lte: to })
    };
  }

  static async list(query: ListOperationsQuery, actor: OperationsActor) {
    const userId = query.mine ? actor.id : undefined;
    const performedAtFilter = OperationsService.dateFilter(query.from, query.to);

    if (query.type === OperationType.REFILE) {
      return OperationsService.listRefileOperations(query, actor, userId, performedAtFilter);
    }
    if (query.type === OperationType.INVENTORY) {
      return OperationsService.listInventoryOperations(query, actor, userId, performedAtFilter);
    }
    if (query.type === OperationType.SEGREGATION) {
      return OperationsService.listSegregationOperations(query, actor, userId, performedAtFilter);
    }

    const summaries: OperationSummary[] = [];

    if (!query.type) {
      const refileWhere: Prisma.RefileEventWhereInput = {
        fileRecord: { companyId: actor.companyId },
        ...(userId && { operatorId: userId }),
        ...(performedAtFilter && { scannedAt: performedAtFilter }),
        ...(query.status === 'COMPLETED' && { action: WorkflowAction.REFILE_SUCCESS }),
        ...(query.status === 'REJECTED' && { action: { in: REFILE_REJECT_ACTIONS } })
      };

      const refiles = await prisma.refileEvent.findMany({
        where: refileWhere,
        include: {
          operator: { select: { id: true, fullName: true, email: true } },
          fileRecord: { select: { barcode: true } }
        },
        orderBy: { scannedAt: 'desc' },
        take: query.limit * query.page
      });

      summaries.push(
        ...refiles.map((event) => ({
          id: event.id,
          type: OperationType.REFILE,
          status: refileActionToStatus(event.action),
          performedAt: event.scannedAt,
          user: event.operator,
          summary: `Refile ${event.fileRecord.barcode}`,
          reasonCode: refileReason(event.action),
          fileBarcode: event.fileRecord.barcode
        }))
      );
    }

    if (
      !query.type ||
      query.type === OperationType.FRESH_BOX ||
      query.type === OperationType.INTAKE
    ) {
      const auditActions = [
        WorkflowAction.FRESH_BOX_MOVE,
        WorkflowAction.BOX_CREATED
      ].filter((action) => {
        const mapped = auditActionToOperationType(action);
        return !query.type || mapped === query.type;
      });

      if (auditActions.length > 0 && query.status !== 'REJECTED') {
        const auditWhere: Prisma.AuditLogWhereInput = {
          companyId: actor.companyId,
          action: { in: auditActions },
          ...(userId && { userId }),
          ...(performedAtFilter && { createdAt: performedAtFilter })
        };

        const logs = await prisma.auditLog.findMany({
          where: auditWhere,
          include: {
            user: { select: { id: true, fullName: true, email: true } },
            box: { select: { id: true, barcode: true } },
            fileRecord: { select: { id: true, barcode: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: query.limit * query.page
        });

        summaries.push(
          ...logs.flatMap((log) => {
            const type = auditActionToOperationType(log.action);
            if (!type) return [];

            const state = (log.newState ?? {}) as Record<string, unknown>;
            let summary = String(log.action);
            let boxBarcode = log.box?.barcode;

            if (type === OperationType.FRESH_BOX) {
              const boxes = Array.isArray(state.boxBarcodes)
                ? state.boxBarcodes.join(', ')
                : auditRelationBarcode(log);
              summary = `Fresh box move → ${boxes ?? 'unknown'}`;
              if (!boxBarcode && Array.isArray(state.boxBarcodes) && state.boxBarcodes.length > 0) {
                boxBarcode = state.boxBarcodes[0] as string;
              }
            } else if (type === OperationType.INTAKE) {
              summary = `Intake ${auditRelationBarcode(log) ?? 'box'}`;
            }

            const item: OperationSummary = {
              id: log.id,
              type,
              status: 'COMPLETED',
              performedAt: log.createdAt,
              user: log.user,
              summary,
              boxId: log.boxId ?? log.box?.id,
              boxBarcode: boxBarcode ?? log.box?.barcode,
              fileId: log.fileRecordId ?? log.fileRecord?.id,
              fileBarcode: log.fileRecord?.barcode
            };

            return [item];
          })
        );
      }
    }

    const sorted = summaries.sort(
      (a, b) => b.performedAt.getTime() - a.performedAt.getTime()
    );

    const total = sorted.length;
    const skip = (query.page - 1) * query.limit;
    const data = sorted.slice(skip, skip + query.limit);

    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    };
  }

  private static async listRefileOperations(
    query: ListOperationsQuery,
    actor: OperationsActor,
    userId: string | undefined,
    performedAtFilter: Prisma.DateTimeFilter | undefined
  ) {
    const skip = (query.page - 1) * query.limit;
    const refileWhere: Prisma.RefileEventWhereInput = {
      fileRecord: { companyId: actor.companyId },
      ...(userId && { operatorId: userId }),
      ...(performedAtFilter && { scannedAt: performedAtFilter }),
      ...(query.status === 'COMPLETED' && { action: WorkflowAction.REFILE_SUCCESS }),
      ...(query.status === 'REJECTED' && { action: { in: REFILE_REJECT_ACTIONS } })
    };

    const [refiles, total] = await prisma.$transaction([
      prisma.refileEvent.findMany({
        where: refileWhere,
        include: {
          operator: { select: { id: true, fullName: true, email: true } },
          fileRecord: { select: { barcode: true } }
        },
        orderBy: { scannedAt: 'desc' },
        skip,
        take: query.limit
      }),
      prisma.refileEvent.count({ where: refileWhere })
    ]);

    return {
      data: refiles.map((event) => ({
        id: event.id,
        type: OperationType.REFILE,
        status: refileActionToStatus(event.action),
        performedAt: event.scannedAt,
        user: event.operator,
        summary: `Refile ${event.fileRecord.barcode}`,
        reasonCode: refileReason(event.action),
        fileBarcode: event.fileRecord.barcode
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    };
  }

  private static async listInventoryOperations(
    query: ListOperationsQuery,
    actor: OperationsActor,
    userId: string | undefined,
    performedAtFilter: Prisma.DateTimeFilter | undefined
  ) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.InventoryVerificationSessionWhereInput = {
      operator: { companyId: actor.companyId },
      ...(userId && { operatorId: userId }),
      ...(performedAtFilter && { startedAt: performedAtFilter }),
      ...(query.hasMissing && { missingFileCount: { gt: 0 } }),
      ...(query.warehouseId && {
        box: {
          currentLocation: {
            shelf: { rack: { room: { warehouseId: query.warehouseId } } }
          }
        }
      })
    };

    const [sessions, total] = await prisma.$transaction([
      prisma.inventoryVerificationSession.findMany({
        where,
        include: {
          operator: { select: { id: true, fullName: true, email: true } },
          box: {
            select: {
              barcode: true,
              currentLocation: {
                select: {
                  shelf: {
                    select: {
                      rack: {
                        select: {
                          room: {
                            select: { warehouse: { select: { name: true } } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          scans: { select: { isExpected: true, isMissingFlag: true } }
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: query.limit
      }),
      prisma.inventoryVerificationSession.count({ where })
    ]);

    return {
      data: sessions.map((session) => ({
        id: session.id,
        type: OperationType.INVENTORY,
        status: 'COMPLETED' as OperationStatus,
        performedAt: session.endedAt ?? session.startedAt,
        user: session.operator,
        summary: `Inventory ${session.box.barcode}`,
        boxBarcode: session.box.barcode,
        warehouseName:
          session.box.currentLocation?.shelf?.rack?.room?.warehouse?.name ?? undefined,
        verifiedCount: session.scans.filter((scan) => scan.isExpected && !scan.isMissingFlag)
          .length,
        missingCount: session.missingFileCount,
        warningsCount: session.unexpectedFileCount
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    };
  }

  private static async listSegregationOperations(
    query: ListOperationsQuery,
    actor: OperationsActor,
    userId: string | undefined,
    performedAtFilter: Prisma.DateTimeFilter | undefined
  ) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.SegregationSessionWhereInput = {
      operator: { companyId: actor.companyId },
      ...(userId && { operatorId: userId }),
      ...(performedAtFilter && { startedAt: performedAtFilter })
    };

    const [sessions, total] = await prisma.$transaction([
      prisma.segregationSession.findMany({
        where,
        include: {
          operator: { select: { id: true, fullName: true, email: true } },
          oldBox: { select: { barcode: true } },
          newBox: { select: { barcode: true } },
          _count: { select: { movedFiles: true } }
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: query.limit
      }),
      prisma.segregationSession.count({ where })
    ]);

    const movedCount = (session: { _count: { movedFiles: number } }) =>
      session._count.movedFiles;

    return {
      data: sessions.map((session) => ({
        id: session.id,
        type: OperationType.SEGREGATION,
        status: 'COMPLETED' as OperationStatus,
        performedAt: session.endedAt ?? session.startedAt,
        user: session.operator,
        summary: `Segregation ${session.oldBox.barcode} → ${session.newBox.barcode}`,
        oldBoxBarcode: session.oldBox.barcode,
        newBoxBarcode: session.newBox.barcode,
        outCount: movedCount(session),
        inCount: movedCount(session)
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    };
  }

  static async get(operationId: string, actor: OperationsActor) {
    const refile = await prisma.refileEvent.findFirst({
      where: {
        id: operationId,
        fileRecord: { companyId: actor.companyId }
      },
      include: {
        operator: { select: { id: true, fullName: true, email: true } },
        fileRecord: { select: { id: true, barcode: true, title: true } },
        expectedBox: { select: { id: true, barcode: true, description: true } },
        scannedLocation: { select: { id: true, barcode: true, name: true } }
      }
    });

    if (refile) {
      const scannedBox = await prisma.box.findUnique({
        where: { id: refile.scannedBoxId },
        select: { id: true, barcode: true, description: true }
      });
      const expectedLocation = refile.expectedLocationId
        ? await prisma.location.findUnique({
            where: { id: refile.expectedLocationId },
            select: { id: true, barcode: true, name: true }
          })
        : null;

      const auditLogs = await prisma.auditLog.findMany({
        where: {
          companyId: actor.companyId,
          fileRecordId: refile.fileRecordId,
          createdAt: { lte: refile.scannedAt }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      return {
        id: refile.id,
        type: OperationType.REFILE,
        status: refileActionToStatus(refile.action),
        performedAt: refile.scannedAt,
        user: refile.operator,
        reasonCode: refileReason(refile.action),
        file: refile.fileRecord,
        expected: {
          location: expectedLocation,
          box: refile.expectedBox
        },
        scanned: {
          location: refile.scannedLocation,
          box: scannedBox
        },
        scanEvents: [
          {
            barcode: refile.fileRecord.barcode,
            scannedAt: refile.scannedAt,
            result: refile.action
          }
        ],
        auditLogs
      };
    }

    const audit = await prisma.auditLog.findFirst({
      where: { id: operationId, companyId: actor.companyId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        device: { select: { id: true, serialNumber: true, model: true } },
        box: { select: { id: true, barcode: true, description: true } },
        fileRecord: { select: { id: true, barcode: true, title: true } },
        location: { select: { id: true, barcode: true, name: true } }
      }
    });

    if (audit) {
      const type = auditActionToOperationType(audit.action);
      if (!type) {
        const error: AppError = new Error('Operation not found');
        error.statusCode = 404;
        error.code = ErrorCode.NOT_FOUND;
        throw error;
      }

      const state = (audit.newState ?? {}) as Record<string, unknown>;
      const scanEvents: Array<Record<string, unknown>> = [];

      if (type === OperationType.FRESH_BOX && Array.isArray(state.boxBarcodes)) {
        for (const barcode of state.boxBarcodes) {
          scanEvents.push({ barcode, type: 'BOX', scannedAt: audit.createdAt });
        }
        if (state.locationBarcode) {
          scanEvents.unshift({
            barcode: state.locationBarcode,
            type: 'LOCATION',
            scannedAt: audit.createdAt
          });
        }
      } else if (type === OperationType.INVENTORY) {
        scanEvents.push({
          barcode: (state.barcode as string | undefined) ?? auditRelationBarcode(audit),
          type: 'FILE_RECORD',
          scannedAt: audit.createdAt,
          isExpected: state.isExpected,
          isMissingFlag: state.isMissingFlag
        });
      }

      const relatedAuditLogs = await prisma.auditLog.findMany({
        where: {
          companyId: actor.companyId,
          OR: [
            ...(audit.boxId ? [{ boxId: audit.boxId }] : []),
            ...(audit.fileRecordId ? [{ fileRecordId: audit.fileRecordId }] : [])
          ],
          id: { not: audit.id }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      return {
        id: audit.id,
        type,
        status: 'COMPLETED' as OperationStatus,
        performedAt: audit.createdAt,
        user: audit.user,
        device: audit.device,
        box: audit.box,
        fileRecord: audit.fileRecord,
        location: audit.location,
        previousState: audit.previousState,
        newState: audit.newState,
        scanEvents,
        auditLogs: [audit, ...relatedAuditLogs]
      };
    }

    const inventorySession = await prisma.inventoryVerificationSession.findFirst({
      where: {
        id: operationId,
        operator: { companyId: actor.companyId }
      },
      include: {
        operator: { select: { id: true, fullName: true, email: true } },
        box: { select: { id: true, barcode: true, description: true } },
        scans: {
          include: { fileRecord: { select: { id: true, barcode: true, title: true } } },
          orderBy: { scannedAt: 'asc' }
        }
      }
    });

    if (inventorySession) {
      return {
        id: inventorySession.id,
        type: OperationType.INVENTORY,
        status: 'COMPLETED' as OperationStatus,
        performedAt: inventorySession.endedAt ?? inventorySession.startedAt,
        user: inventorySession.operator,
        box: inventorySession.box,
        summary: {
          missingFileCount: inventorySession.missingFileCount,
          unexpectedFileCount: inventorySession.unexpectedFileCount,
          scanCount: inventorySession.scans.length
        },
        scanEvents: inventorySession.scans.map((scan) => ({
          barcode: scan.fileRecord?.barcode ?? 'UNKNOWN',
          scannedAt: scan.scannedAt,
          isExpected: scan.isExpected,
          isMissingFlag: scan.isMissingFlag
        })),
        auditLogs: []
      };
    }

    const segregationSession = await prisma.segregationSession.findFirst({
      where: {
        id: operationId,
        operator: { companyId: actor.companyId }
      },
      include: {
        operator: { select: { id: true, fullName: true, email: true } },
        oldBox: { select: { id: true, barcode: true, description: true } },
        newBox: { select: { id: true, barcode: true, description: true } },
        movedFiles: {
          include: {
            fileRecord: {
              select: {
                id: true,
                barcode: true,
                title: true,
                box: { select: { client: { select: { code: true, name: true } } } }
              }
            }
          }
        }
      }
    });

    if (segregationSession) {
      return {
        id: segregationSession.id,
        type: OperationType.SEGREGATION,
        status: 'COMPLETED' as OperationStatus,
        performedAt: segregationSession.endedAt ?? segregationSession.startedAt,
        user: segregationSession.operator,
        oldBox: segregationSession.oldBox,
        newBox: segregationSession.newBox,
        scanEvents: segregationSession.movedFiles.flatMap((move) => {
          const clientName = move.fileRecord.box?.client?.name;
          return [
            {
              barcode: move.fileRecord.barcode,
              scannedAt: move.movedAt,
              remark: 'OUT',
              client: clientName
            },
            {
              barcode: move.fileRecord.barcode,
              scannedAt: move.movedAt,
              remark: 'IN',
              client: clientName
            }
          ];
        }),
        auditLogs: []
      };
    }

    const error: AppError = new Error('Operation not found');
    error.statusCode = 404;
    error.code = ErrorCode.NOT_FOUND;
    throw error;
  }
}
