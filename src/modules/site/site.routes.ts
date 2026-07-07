import { Router } from 'express';
import { SiteController } from './site.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('site:view') as any, SiteController.listSites as any);
router.post('/', requirePermission('site:manage') as any, SiteController.createSite as any);
router.put('/:siteId', requirePermission('site:manage') as any, SiteController.updateSite as any);
router.delete('/:siteId', requirePermission('site:manage') as any, SiteController.deleteSite as any);

export default router;
