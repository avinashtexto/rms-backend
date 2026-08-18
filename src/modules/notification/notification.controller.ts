import { Response, NextFunction } from 'express';
import { NotificationService } from './notification.service';
import { AuthenticatedRequest } from '../auth/auth.types';
import { createNotificationSchema, notificationQuerySchema } from './notification.validation';

export class NotificationController {
  static async createNotification(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const parsedBody = createNotificationSchema.parse(req.body);

      const result = await NotificationService.createNotification({
        ...parsedBody,
        companyId
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async listNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const userId = req.user!.id;
      const parsedQuery = notificationQuerySchema.parse(req.query);
      const adminView = req.query.adminView === 'true';

      const result = await NotificationService.listNotifications(userId, companyId, {
        ...parsedQuery,
        adminView
      });
      res.status(200).json({ success: true, data: result.items, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  static async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      const notificationId = req.params.notificationId as string;
      const result = await NotificationService.markAsRead(userId, companyId, notificationId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      const result = await NotificationService.markAllAsRead(userId, companyId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async deleteNotification(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      const notificationId = req.params.notificationId as string;
      const result = await NotificationService.deleteNotification(userId, companyId, notificationId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
