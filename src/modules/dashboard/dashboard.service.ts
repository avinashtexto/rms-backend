import { prisma } from '../../lib/prisma';

export class DashboardService {
  static async getDashboardMetrics(companyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

  static async getScanActivity(companyId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const scans = await prisma.freshBoxMoveScan.groupBy({
      by: ['scannedAt'],
      where: {
        scannedAt: { gte: startDate }
      },
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

  static async getRecentActivity(companyId: string, limit: number = 10) {
    const logs = await prisma.auditLog.findMany({
      where: { companyId },
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
