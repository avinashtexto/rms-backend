import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

// Mobile clients (NotificationDto) require a non-null `priority` and an optional
// `actionUrl`. The Notification model stores neither, so we derive them from the
// notification `type`. Kept here so both fields stay consistent across endpoints.
const NOTIFICATION_PRIORITY: Record<string, string> = {
  DUPLICATE_SCAN: 'MEDIUM',
  WRONG_LOCATION: 'HIGH',
  WRONG_BOX: 'HIGH',
  INVENTORY_PENDING: 'HIGH',
  SYNC_FAILED: 'HIGH',
  LOW_BATTERY: 'LOW',
  GPS_DISABLED: 'MEDIUM'
};

const NOTIFICATION_ACTION_URL: Record<string, string> = {
  DUPLICATE_SCAN: '/audit-logs',
  WRONG_LOCATION: '/locations',
  WRONG_BOX: '/boxes',
  INVENTORY_PENDING: '/workflows/inventory-verification',
  SYNC_FAILED: '/sync',
  LOW_BATTERY: '/devices',
  GPS_DISABLED: '/gps'
};

function decorateNotification(n: {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    priority: NOTIFICATION_PRIORITY[n.type] ?? 'MEDIUM',
    createdAt: n.createdAt,
    actionUrl: NOTIFICATION_ACTION_URL[n.type] ?? null
  };
}

export class NotificationService {
  static async createNotification(data: {
    companyId: string;
    title: string;
    message: string;
    type: 'DUPLICATE_SCAN' | 'WRONG_LOCATION' | 'WRONG_BOX' | 'INVENTORY_PENDING' | 'SYNC_FAILED' | 'LOW_BATTERY' | 'GPS_DISABLED';
    targetUserId?: string;
  }) {
    // If targetUserId is specified and not 'ALL', create for single user
    if (data.targetUserId && data.targetUserId !== 'ALL') {
      const notification = await prisma.notification.create({
        data: {
          companyId: data.companyId,
          userId: data.targetUserId,
          type: data.type,
          title: data.title,
          message: data.message
        }
      });
      return decorateNotification(notification);
    }

    // Otherwise broadcast to all active users in the company
    const users = await prisma.user.findMany({
      where: { companyId: data.companyId, status: 'ACTIVE' },
      select: { id: true }
    });

    if (users.length === 0) {
      throw new Error('No users found in company to send notification to');
    }

    const createdNotifications = await prisma.$transaction(
      users.map(u =>
        prisma.notification.create({
          data: {
            companyId: data.companyId,
            userId: u.id,
            type: data.type,
            title: data.title,
            message: data.message
          }
        })
      )
    );

    return createdNotifications.map(decorateNotification);
  }

  static async listNotifications(
    userId: string,
    companyId: string,
    query?: {
      search?: string;
      type?: string;
      isRead?: boolean;
      adminView?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    
    // If not adminView, limit to specific user
    if (!query?.adminView) {
      where.userId = userId;
    }

    if (query?.type && query.type !== 'ALL') {
      where.type = query.type;
    }

    if (query?.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    if (query?.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { message: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    const [total, list] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ]);

    const items = list.map(decorateNotification);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async markAsRead(userId: string, companyId: string, notificationId: string) {
    const notif = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        companyId,
        OR: [
          { userId },
          { companyId }
        ]
      }
    });

    if (!notif) {
      const error: AppError = new Error('Notification not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });

    return decorateNotification(updated);
  }

  static async markAllAsRead(userId: string, companyId: string) {
    return prisma.notification.updateMany({
      where: {
        companyId,
        isRead: false
      },
      data: { isRead: true }
    });
  }

  static async deleteNotification(userId: string, companyId: string, notificationId: string) {
    const notif = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        companyId
      }
    });

    if (!notif) {
      const error: AppError = new Error('Notification not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    await prisma.notification.delete({ where: { id: notificationId } });
    return { id: notificationId };
  }
}
