import { Response, NextFunction } from 'express';
import { ClientService } from './client.service';
import { createClientSchema, updateClientSchema, createDepartmentSchema, updateDepartmentSchema } from './client.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class ClientController {
  // ==========================================
  // CLIENTS
  // ==========================================
  
  static async listClients(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const page = parseInt(req.query.page as string, 10) || 1;
      const pageSize = parseInt(req.query.pageSize as string, 10) || 20;
      const result = await ClientService.listClients(companyId, page, pageSize);
      res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  static async getClientById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const clientId = req.params.id as string;
      const client = await ClientService.getClientById(companyId, clientId);
      res.status(200).json({ success: true, data: client });
    } catch (error) {
      next(error);
    }
  }

  static async createClient(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const data = createClientSchema.parse(req.body);
      const client = await ClientService.createClient(
        companyId,
        data.name,
        data.code,
        data.contactEmail,
        data.contactPhone
      );
      res.status(201).json({ success: true, data: client });
    } catch (error) {
      next(error);
    }
  }

  static async updateClient(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const clientId = req.params.id as string;
      const data = updateClientSchema.parse(req.body);
      const client = await ClientService.updateClient(
        companyId,
        clientId,
        data.name,
        data.contactEmail,
        data.contactPhone,
        data.isActive
      );
      res.status(200).json({ success: true, data: client });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DEPARTMENTS
  // ==========================================

  static async listDepartments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const clientId = req.params.id as string;
      const departments = await ClientService.listDepartments(companyId, clientId);
      res.status(200).json({ success: true, data: departments });
    } catch (error) {
      next(error);
    }
  }

  static async createDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const clientId = req.params.id as string;
      const data = createDepartmentSchema.parse(req.body);
      const department = await ClientService.createDepartment(
        companyId,
        clientId,
        data.name,
        data.code
      );
      res.status(201).json({ success: true, data: department });
    } catch (error) {
      next(error);
    }
  }

  static async updateDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const departmentId = req.params.id as string;
      const data = updateDepartmentSchema.parse(req.body);
      const department = await ClientService.updateDepartment(
        companyId,
        departmentId,
        data.name,
        data.isActive
      );
      res.status(200).json({ success: true, data: department });
    } catch (error) {
      next(error);
    }
  }

  static async deleteClient(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const clientId = req.params.id as string;
      await ClientService.deleteClient(companyId, clientId);
      res.status(200).json({
        success: true,
        message: 'Client deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const departmentId = req.params.id as string;
      await ClientService.deleteDepartment(companyId, departmentId);
      res.status(200).json({
        success: true,
        message: 'Department deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
