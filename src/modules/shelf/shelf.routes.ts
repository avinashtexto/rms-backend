import { Router } from 'express';
import { ShelfController } from './shelf.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('shelf:view') as any, ShelfController.listShelves as any);
router.get('/:shelfId', requirePermission('shelf:view') as any, ShelfController.getShelf as any);
router.post('/', requirePermission('shelf:manage') as any, ShelfController.createShelf as any);
router.put('/:shelfId', requirePermission('shelf:manage') as any, ShelfController.updateShelf as any);
router.delete('/:shelfId', requirePermission('shelf:manage') as any, ShelfController.deleteShelf as any);

export default router;
