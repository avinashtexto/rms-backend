import { Request, Response, NextFunction } from 'express';
import { splashStatusSchema } from './splash.validation';
import { SplashService } from './splash.service';

export class SplashController {
  static async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const query = splashStatusSchema.parse(req.query);
      const result = await SplashService.getStatus(query.deviceId);

      res.status(200).json({
        success: true,
        message: 'Splash status retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}
