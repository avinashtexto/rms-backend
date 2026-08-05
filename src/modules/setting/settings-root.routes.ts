import { Router } from 'express';
import { SettingController } from './setting.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/company', requirePermission('settings:view') as any, SettingController.getCompanySettings as any);
router.patch('/company', requirePermission('settings:manage') as any, SettingController.updateCompanySettings as any);

export default router;
