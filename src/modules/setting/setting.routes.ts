import { Router } from 'express';
import { SettingController } from './setting.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

// Settings
router.get('/company', requirePermission('settings:view') as any, SettingController.getCompanySettings as any);
router.put('/company', requirePermission('settings:manage') as any, SettingController.updateCompanySettings as any);

// Reason Codes
router.get('/reason-codes', requirePermission('settings:view') as any, SettingController.listReasonCodes as any);
router.post('/reason-codes', requirePermission('settings:manage') as any, SettingController.createReasonCode as any);

export default router;
