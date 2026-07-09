import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class ClientService {
  // ==========================================
  // CLIENTS
  // ==========================================
  
  static async listClients(companyId: string, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;
    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.client.count({ where: { companyId } })
    ]);

    return {
      data: clients,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    };
  }

  static async getClientById(companyId: string, clientId: string) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId }
    });

    if (!client) {
      const error: AppError = new Error('Client not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return client;
  }

  static async createClient(
    companyId: string,
    name: string,
    code: string,
    contactEmail?: string | null,
    contactPhone?: string | null
  ) {
    const existing = await prisma.client.findUnique({
      where: {
        companyId_code: { companyId, code }
      }
    });

    if (existing) {
      const error: AppError = new Error(`Client with code '${code}' already exists`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.client.create({
      data: {
        companyId,
        name,
        code,
        contactEmail,
        contactPhone
      }
    });
  }

  static async updateClient(
    companyId: string,
    clientId: string,
    name?: string,
    contactEmail?: string | null,
    contactPhone?: string | null,
    isActive?: boolean
  ) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId }
    });

    if (!client) {
      const error: AppError = new Error('Client not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.client.update({
      where: { id: clientId },
      data: {
        name: name !== undefined ? name : client.name,
        contactEmail: contactEmail !== undefined ? contactEmail : client.contactEmail,
        contactPhone: contactPhone !== undefined ? contactPhone : client.contactPhone,
        isActive: isActive !== undefined ? isActive : client.isActive
      }
    });
  }

  static async deleteClient(companyId: string, clientId: string) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId }
    });

    if (!client) {
      const error: AppError = new Error('Client not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.client.delete({
      where: { id: clientId }
    });
  }

  // ==========================================
  // DEPARTMENTS
  // ==========================================

  static async listDepartments(companyId: string, clientId: string) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId }
    });

    if (!client) {
      const error: AppError = new Error('Client not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.department.findMany({
      where: { clientId },
      orderBy: { code: 'asc' }
    });
  }

  static async createDepartment(companyId: string, clientId: string, name: string, code: string) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId }
    });

    if (!client) {
      const error: AppError = new Error('Client not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    const existing = await prisma.department.findUnique({
      where: {
        clientId_code: { clientId, code }
      }
    });

    if (existing) {
      const error: AppError = new Error(`Department with code '${code}' already exists under this Client`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.department.create({
      data: {
        clientId,
        name,
        code
      }
    });
  }

  static async updateDepartment(companyId: string, departmentId: string, name?: string, isActive?: boolean) {
    const dept = await prisma.department.findFirst({
      where: { id: departmentId, client: { companyId } }
    });

    if (!dept) {
      const error: AppError = new Error('Department not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.department.update({
      where: { id: departmentId },
      data: {
        name: name !== undefined ? name : dept.name,
        isActive: isActive !== undefined ? isActive : dept.isActive
      }
    });
  }

  static async deleteDepartment(companyId: string, departmentId: string) {
    const dept = await prisma.department.findFirst({
      where: { id: departmentId, client: { companyId } }
    });

    if (!dept) {
      const error: AppError = new Error('Department not found or access denied');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.department.delete({
      where: { id: departmentId }
    });
  }
}
