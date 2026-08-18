import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';
import { DashboardQueryInput } from './dashboard.validation';

export interface ResolvedScope {
  companyId?: string;
  warehouseId?: string;
  startDate: Date;
  endDate: Date;
  days: number;
  status?: string;
  operationType?: string;
}

export class DashboardService {
  static async resolveScopeAndValidate(
    user: { id: string; companyId?: string | null; warehouseId?: string | null; role?: { name: string } | null; roleName?: string | null; warehouses?: any[] | null },
    query: DashboardQueryInput
  ): Promise<ResolvedScope> {
    const roleName = user.roleName || user.role?.name;
    const isSuperAdmin = roleName === 'SUPER_ADMIN';
    const isCompanyAdmin = roleName === 'COMPANY_ADMIN';

    let resolvedCompanyId: string | undefined = undefined;
    let resolvedWarehouseId: string | undefined = undefined;

    if (isSuperAdmin) {
      if (query.companyId && query.companyId !== 'ALL') {
        resolvedCompanyId = query.companyId;
      }
      if (query.warehouseId && query.warehouseId !== 'ALL') {
        resolvedWarehouseId = query.warehouseId;
        if (resolvedCompanyId) {
          const warehouse = await prisma.warehouse.findUnique({
            where: { id: resolvedWarehouseId },
            select: { companyId: true }
          });
          if (!warehouse || warehouse.companyId !== resolvedCompanyId) {
            const error: AppError = new Error('Selected warehouse does not belong to the selected company');
            error.statusCode = 422;
            error.code = ErrorCode.VALIDATION_ERROR;
            throw error;
          }
        }
      }
    } else if (isCompanyAdmin) {
      if (!user.companyId) {
        const error: AppError = new Error('Company context missing for company administrator');
        error.statusCode = 403;
        error.code = ErrorCode.FORBIDDEN;
        throw error;
      }
      resolvedCompanyId = user.companyId;

      if (query.warehouseId && query.warehouseId !== 'ALL') {
        const warehouse = await prisma.warehouse.findUnique({
          where: { id: query.warehouseId },
          select: { companyId: true }
        });
        if (!warehouse || warehouse.companyId !== user.companyId) {
          const error: AppError = new Error('Access denied: Warehouse does not belong to your company');
          error.statusCode = 403;
          error.code = ErrorCode.FORBIDDEN;
          throw error;
        }
        resolvedWarehouseId = query.warehouseId;
      }
    } else {
      // Warehouse Admin / Operator
      if (!user.companyId) {
        const error: AppError = new Error('Company context missing');
        error.statusCode = 403;
        error.code = ErrorCode.FORBIDDEN;
        throw error;
      }
      resolvedCompanyId = user.companyId;

      const userWarehouseId = user.warehouseId || user.warehouses?.[0]?.id || user.warehouses?.[0]?.warehouseId;
      if (!userWarehouseId) {
        const error: AppError = new Error('No warehouse assigned to your account');
        error.statusCode = 403;
        error.code = ErrorCode.FORBIDDEN;
        throw error;
      }

      if (query.warehouseId && query.warehouseId !== 'ALL' && query.warehouseId !== userWarehouseId) {
        const error: AppError = new Error('Access denied: You can only access your assigned warehouse');
        error.statusCode = 403;
        error.code = ErrorCode.FORBIDDEN;
        throw error;
      }
      resolvedWarehouseId = userWarehouseId;
    }

    // Resolve date range
    let startDate: Date;
    let endDate = new Date();
    let days = query.days || 7;

    if (query.fromDate) {
      startDate = new Date(query.fromDate);
      if (isNaN(startDate.getTime())) {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
      }
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
    }

    if (query.toDate) {
      endDate = new Date(query.toDate);
      if (isNaN(endDate.getTime())) {
        endDate = new Date();
      }
    }

    return {
      companyId: resolvedCompanyId,
      warehouseId: resolvedWarehouseId,
      startDate,
      endDate,
      days,
      status: query.status && query.status !== 'ALL' ? query.status : undefined,
      operationType: query.operationType && query.operationType !== 'ALL' ? query.operationType : undefined
    };
  }

  static async getDashboardMetrics(scope: ResolvedScope) {
    const { companyId, warehouseId, startDate, endDate, status } = scope;

    if (warehouseId) {
      const locationWhere: any = { shelf: { rack: { room: { warehouseId } } } };
      const boxWhere: any = { currentLocation: locationWhere };
      if (companyId) boxWhere.companyId = companyId;
      if (status) boxWhere.status = status;

      const [
        whHierarchy,
        totalRooms,
        totalRacks,
        totalLocations,
        occupiedLocations,
        totalBoxes,
        activeBoxes,
        totalFiles,
        scansPeriod,
        pendingWorkOrders,
        freshBoxMoves,
        transfers,
        refiles,
        pendingSegregations
      ] = await Promise.all([
        prisma.warehouse.findUnique({
          where: { id: warehouseId },
          select: {
            id: true,
            siteId: true,
            site: {
              select: {
                id: true,
                branchId: true
              }
            }
          }
        }),
        prisma.room.count({ where: { warehouseId, isActive: true } }),
        prisma.rack.count({ where: { room: { warehouseId } } }),
        prisma.location.count({ where: locationWhere }),
        prisma.location.count({ where: { ...locationWhere, isOccupied: true } }),
        prisma.box.count({ where: boxWhere }),
        prisma.box.count({ where: { ...boxWhere, status: 'ACTIVE' } }),
        prisma.fileRecord.count({
          where: {
            ...(companyId ? { companyId } : {}),
            box: boxWhere,
            status: 'ACTIVE'
          }
        }),
        prisma.freshBoxMoveScan.count({
          where: {
            scannedAt: { gte: startDate, lte: endDate },
            location: locationWhere
          }
        }),
        prisma.workOrder.count({
          where: {
            ...(companyId ? { companyId } : {}),
            status: { in: ['PENDING', 'IN_PROGRESS'] as any }
          }
        }).catch(() => 0),
        prisma.freshBoxMoveScan.count({
          where: {
            scannedAt: { gte: startDate, lte: endDate },
            location: locationWhere
          }
        }),
        prisma.transfer.count({
          where: {
            OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }],
            createdAt: { gte: startDate, lte: endDate }
          }
        }).catch(() => 0),
        prisma.refileEvent.count({
          where: {
            scannedAt: { gte: startDate, lte: endDate },
            scannedLocation: locationWhere
          }
        }).catch(() => 0),
        prisma.segregationSession.count({
          where: {
            endedAt: null
          }
        }).catch(() => 0)
      ]);

      const totalSites = whHierarchy?.siteId ? 1 : 0;
      const totalBranches = whHierarchy?.site?.branchId ? 1 : 0;

      return {
        warehouseId,
        companyId,
        totalWarehouses: 1,
        totalBranches,
        totalSites,
        totalRooms,
        totalRacks,
        totalLocations,
        occupiedLocations,
        availableLocations: Math.max(0, totalLocations - occupiedLocations),
        occupancyRate: totalLocations > 0 ? Math.round((occupiedLocations / totalLocations) * 100) : 0,
        totalBoxes,
        activeBoxes,
        totalFiles,
        scansToday: scansPeriod,
        scansPeriod,
        pendingOperations: pendingWorkOrders + pendingSegregations,
        pendingWorkOrders,
        todayFreshBoxMoves: freshBoxMoves,
        todayTransfers: transfers,
        todayRefiles: refiles,
        pendingSegregations
      };
    }

    if (companyId) {
      const boxWhere: any = { companyId };
      if (status) boxWhere.status = status;

      const [totalWarehouses, totalBranches, totalSites, totalBoxes, totalFiles, scansPeriod, activeUsers, pendingWorkOrders] = await Promise.all([
        prisma.warehouse.count({
          where: { companyId, isActive: true }
        }),
        prisma.branch.count({
          where: { companyId, isActive: true, deletedAt: null }
        }),
        prisma.site.count({
          where: { companyId, isActive: true, branch: { isActive: true, deletedAt: null } }
        }),
        prisma.box.count({
          where: boxWhere
        }),
        prisma.fileRecord.count({
          where: { companyId, status: 'ACTIVE' }
        }),
        prisma.freshBoxMoveScan.count({
          where: {
            scannedAt: { gte: startDate, lte: endDate },
            location: { shelf: { rack: { room: { warehouse: { companyId } } } } }
          }
        }),
        prisma.user.count({
          where: { companyId, status: 'ACTIVE' }
        }),
        prisma.workOrder.count({
          where: { companyId, status: { in: ['PENDING', 'IN_PROGRESS'] as any } }
        }).catch(() => 0)
      ]);

      return {
        companyId,
        totalWarehouses,
        totalBranches,
        totalSites,
        totalBoxes,
        totalFiles,
        scansToday: scansPeriod,
        scansPeriod,
        activeUsers,
        pendingWorkOrders
      };
    }

    // Global Super Admin metrics (no companyId, no warehouseId)
    const [totalCompanies, totalBranches, totalSites, totalWarehouses, totalBoxes, totalFiles, scansPeriod, activeUsers] = await Promise.all([
      prisma.company.count({ where: { isActive: true } }),
      prisma.branch.count({ where: { isActive: true, deletedAt: null } }),
      prisma.site.count({ where: { isActive: true, branch: { isActive: true, deletedAt: null } } }),
      prisma.warehouse.count({ where: { isActive: true } }),
      prisma.box.count({ where: { status: 'ACTIVE' } }),
      prisma.fileRecord.count({ where: { status: 'ACTIVE' } }),
      prisma.freshBoxMoveScan.count({
        where: { scannedAt: { gte: startDate, lte: endDate } }
      }),
      prisma.user.count({ where: { status: 'ACTIVE' } })
    ]);

    return {
      totalCompanies,
      totalBranches,
      totalSites,
      totalWarehouses,
      totalBoxes,
      totalFiles,
      scansToday: scansPeriod,
      scansPeriod,
      activeUsers
    };
  }

  static async getSuperAdminSummary(scope?: ResolvedScope) {
    const companyId = scope?.companyId;
    const warehouseId = scope?.warehouseId;
    const startDate = scope?.startDate || new Date(Date.now() - 7 * 86400000);
    const endDate = scope?.endDate || new Date();

    let companyWhere: any = { isActive: true };
    let branchWhere: any = { isActive: true, deletedAt: null };
    let siteWhere: any = { isActive: true, branch: { isActive: true, deletedAt: null } };
    let warehouseWhere: any = { isActive: true };
    let userWhere: any = { status: 'ACTIVE' as const };
    let clientWhere: any = { isActive: true };
    let vendorWhere: any = { isActive: true };
    let boxWhere: any = { status: 'ACTIVE' };
    let fileWhere: any = { status: 'ACTIVE' };
    let scanWhere: any = { scannedAt: { gte: startDate, lte: endDate } };

    if (warehouseId) {
      warehouseWhere = { id: warehouseId, isActive: true };
      const wh = await prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: {
          siteId: true,
          site: {
            select: {
              branchId: true
            }
          }
        }
      });
      if (wh?.siteId) {
        siteWhere = { id: wh.siteId, isActive: true };
      } else {
        siteWhere = { id: '__none__' };
      }
      if (wh?.site?.branchId) {
        branchWhere = { id: wh.site.branchId, isActive: true, deletedAt: null };
      } else {
        branchWhere = { id: '__none__' };
      }
      boxWhere.currentLocation = { shelf: { rack: { room: { warehouseId } } } };
      fileWhere.box = boxWhere;
      scanWhere.location = { shelf: { rack: { room: { warehouseId } } } };
    } else if (companyId) {
      companyWhere = { id: companyId, isActive: true };
      branchWhere = { companyId, isActive: true, deletedAt: null };
      siteWhere = { companyId, isActive: true, branch: { isActive: true, deletedAt: null } };
      warehouseWhere = { companyId, isActive: true };
      userWhere = { companyId, status: 'ACTIVE' as const };
      clientWhere = { companyId, isActive: true };
      vendorWhere = { companyId, isActive: true };
      boxWhere.companyId = companyId;
      fileWhere.companyId = companyId;
      scanWhere.location = { shelf: { rack: { room: { warehouse: { companyId } } } } };
    }

    const [
      totalCompanies,
      totalBranches,
      totalSites,
      totalWarehouses,
      totalUsers,
      totalClients,
      totalVendors,
      totalBoxes,
      totalFiles,
      scansToday
    ] = await Promise.all([
      prisma.company.count({ where: companyWhere }),
      prisma.branch.count({ where: branchWhere }),
      prisma.site.count({ where: siteWhere }),
      prisma.warehouse.count({ where: warehouseWhere }),
      prisma.user.count({ where: userWhere }),
      prisma.client.count({ where: clientWhere }),
      prisma.vendor.count({ where: vendorWhere }),
      prisma.box.count({ where: boxWhere }),
      prisma.fileRecord.count({ where: fileWhere }),
      prisma.freshBoxMoveScan.count({ where: scanWhere })
    ]);

    return {
      totalCompanies,
      totalBranches,
      totalSites,
      totalWarehouses,
      totalUsers,
      totalClients,
      totalVendors,
      totalBoxes,
      totalFiles,
      scansToday
    };
  }

  static async getScanActivity(scope: ResolvedScope) {
    const { companyId, warehouseId, startDate, endDate, days } = scope;

    const where: any = {
      scannedAt: { gte: startDate, lte: endDate }
    };

    if (warehouseId) {
      where.location = { shelf: { rack: { room: { warehouseId } } } };
    } else if (companyId) {
      where.location = { shelf: { rack: { room: { warehouse: { companyId } } } } };
    }

    const scans = await prisma.freshBoxMoveScan.groupBy({
      by: ['scannedAt'],
      where,
      _count: { id: true },
      orderBy: { scannedAt: 'asc' }
    });

    const activityMap = new Map<string, number>();
    scans.forEach(scan => {
      const dateKey = scan.scannedAt.toISOString().split('T')[0];
      activityMap.set(dateKey, (activityMap.get(dateKey) || 0) + scan._count.id);
    });

    const numDays = Math.max(1, Math.min(days || 7, 365));
    const result = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      result.push({
        date: dateKey,
        scans: activityMap.get(dateKey) || 0
      });
    }

    return result;
  }

  static async getRecentActivity(scope: ResolvedScope, limit: number = 10) {
    const { companyId, warehouseId, startDate, endDate, operationType } = scope;

    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (warehouseId) {
      where.OR = [
        { warehouseId },
        { location: { shelf: { rack: { room: { warehouseId } } } } }
      ];
    }
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }
    if (operationType) {
      where.action = { contains: operationType, mode: 'insensitive' };
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return logs.map(log => ({
      id: log.id,
      userId: log.userId,
      userName: log.user?.fullName || 'Unknown User',
      action: log.action,
      location: log.locationId || undefined,
      timestamp: log.createdAt,
      status: 'success' as const
    }));
  }
}
