import { prisma } from '../../lib/prisma';

export class DashboardService {
  static async getDashboardMetrics(companyId: string, warehouseId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (warehouseId) {
      const locationWhere = { shelf: { rack: { room: { warehouseId } } } };
      const boxWhere = { companyId, currentLocation: locationWhere };

      const [
        totalRooms,
        totalRacks,
        totalLocations,
        occupiedLocations,
        totalBoxes,
        activeBoxes,
        totalFiles,
        scansToday,
        pendingWorkOrders,
        todayFreshBoxMoves,
        todayTransfers,
        todayRefiles,
        pendingSegregations
      ] = await Promise.all([
        prisma.room.count({ where: { warehouseId, isActive: true } }),
        prisma.rack.count({ where: { room: { warehouseId } } }),
        prisma.location.count({ where: locationWhere }),
        prisma.location.count({ where: { ...locationWhere, isOccupied: true } }),
        prisma.box.count({ where: boxWhere }),
        prisma.box.count({ where: { ...boxWhere, status: 'ACTIVE' } }),
        prisma.fileRecord.count({
          where: { companyId, box: boxWhere, status: 'ACTIVE' }
        }),
        prisma.freshBoxMoveScan.count({
          where: {
            scannedAt: { gte: today },
            location: locationWhere
          }
        }),
        prisma.workOrder.count({
          where: {
            companyId,
            status: { in: ['PENDING', 'IN_PROGRESS'] as any }
          }
        }).catch(() => 0),
        prisma.freshBoxMoveScan.count({
          where: {
            scannedAt: { gte: today },
            location: locationWhere
          }
        }),
        prisma.transfer.count({
          where: {
            OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }],
            createdAt: { gte: today }
          }
        }).catch(() => 0),
        prisma.refileEvent.count({
          where: {
            scannedAt: { gte: today },
            scannedLocation: locationWhere
          }
        }).catch(() => 0),
        prisma.segregationSession.count({
          where: {
            endedAt: null
          }
        }).catch(() => 0)
      ]);

      return {
        warehouseId,
        totalRooms,
        totalRacks,
        totalLocations,
        occupiedLocations,
        availableLocations: Math.max(0, totalLocations - occupiedLocations),
        occupancyRate: totalLocations > 0 ? Math.round((occupiedLocations / totalLocations) * 100) : 0,
        totalBoxes,
        activeBoxes,
        totalFiles,
        scansToday,
        pendingOperations: pendingWorkOrders + pendingSegregations,
        pendingWorkOrders,
        todayFreshBoxMoves,
        todayTransfers,
        todayRefiles,
        pendingSegregations
      };
    }

    const [totalWarehouses, totalBoxes, totalFiles, scansToday, activeUsers] = await Promise.all([
      prisma.warehouse.count({
        where: { companyId, isActive: true }
      }),
      prisma.box.count({
        where: { companyId, status: 'ACTIVE' }
      }),
      prisma.fileRecord.count({
        where: { companyId, status: 'ACTIVE' }
      }),
      prisma.freshBoxMoveScan.count({
        where: {
          scannedAt: { gte: today }
        }
      }),
      prisma.user.count({
        where: { companyId, status: 'ACTIVE' }
      })
    ]);

    return {
      totalWarehouses,
      totalBoxes,
      totalFiles,
      scansToday,
      activeUsers
    };
  }

  static async getSuperAdminSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
      prisma.company.count({ where: { isActive: true } }),
      prisma.branch.count({ where: { isActive: true, deletedAt: null } }),
      prisma.site.count({ where: { isActive: true } }),
      prisma.warehouse.count({ where: { isActive: true } }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.client.count({ where: { isActive: true } }),
      prisma.vendor.count({ where: { isActive: true } }),
      prisma.box.count({ where: { status: 'ACTIVE' } }),
      prisma.fileRecord.count({ where: { status: 'ACTIVE' } }),
      prisma.freshBoxMoveScan.count({ where: { scannedAt: { gte: today } } })
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

  static async getScanActivity(companyId: string, days: number = 7, warehouseId?: string) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const where: any = {
      scannedAt: { gte: startDate }
    };

    if (warehouseId) {
      where.location = { shelf: { rack: { room: { warehouseId } } } };
    }

    const scans = await prisma.freshBoxMoveScan.groupBy({
      by: ['scannedAt'],
      where,
      _count: {
        id: true
      },
      orderBy: {
        scannedAt: 'asc'
      }
    });

    // Group by date
    const activityMap = new Map<string, number>();
    scans.forEach(scan => {
      const dateKey = scan.scannedAt.toISOString().split('T')[0];
      activityMap.set(dateKey, (activityMap.get(dateKey) || 0) + scan._count.id);
    });

    // Fill in missing dates
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      result.push({
        date: dateKey,
        scans: activityMap.get(dateKey) || 0
      });
    }

    return result;
  }

  static async getRecentActivity(companyId: string, limit: number = 10, warehouseId?: string) {
    const where: any = { companyId };
    if (warehouseId) {
      where.OR = [
        { warehouseId },
        { location: { shelf: { rack: { room: { warehouseId } } } } }
      ];
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
