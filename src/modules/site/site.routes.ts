import { Router } from 'express';
import { SiteController } from './site.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

// Public: no auth required — used by the mobile login screen to populate the site picker
router.get('/public', SiteController.listPublicSites as any);

router.use(requireAuth as any);

router.get('/', requirePermission('site:view') as any, SiteController.listSites as any);
router.get('/:id', requirePermission('site:view') as any, SiteController.getSiteById as any);
router.post('/', requirePermission('site:manage') as any, SiteController.createSite as any);
router.put('/:id', requirePermission('site:manage') as any, SiteController.updateSite as any);
router.delete('/:id', requirePermission('site:manage') as any, SiteController.deleteSite as any);

export default router;
