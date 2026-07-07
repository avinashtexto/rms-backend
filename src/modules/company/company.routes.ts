import { Router } from 'express';
import { CompanyController } from './company.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('company:view') as any, CompanyController.listCompanies as any);
router.post('/', requirePermission('company:manage') as any, CompanyController.createCompany as any);
router.put('/:companyId', requirePermission('company:manage') as any, CompanyController.updateCompany as any);
router.delete('/:companyId', requirePermission('company:manage') as any, CompanyController.deleteCompany as any);

export default router;
