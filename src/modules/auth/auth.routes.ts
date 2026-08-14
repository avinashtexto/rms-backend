import { Router } from 'express';
import { AuthController } from './auth.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.get('/me', requireAuth as any, AuthController.me as any);
router.get('/permissions', requireAuth as any, AuthController.permissions as any);
router.post('/switch-warehouse', requireAuth as any, AuthController.switchWarehouse as any);
router.post('/switch-branch', requireAuth as any, AuthController.switchBranch as any);
router.post('/switch-company', requireAuth as any, AuthController.switchCompany as any);
router.post('/device-bind', requireAuth as any, AuthController.deviceBind as any);

export default router;
