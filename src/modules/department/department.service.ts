import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class DepartmentService {
  static async listDepartments(clientId?: string) {
    return prisma.department.findMany({
      where: clientId ? { clientId } : undefined,
      include: {
        client: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getDepartment(id: string) {
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        client: true
      }
    });

    if (!department) {
      const error: AppError = new Error('Department not found');
      error.statusCode = 404;
      error.code = ErrorCode.DEPARTMENT_NOT_FOUND;
      throw error;
    }

    return department;
  }

  static async createDepartment(clientId: string, name: string, code: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!client) {
      const error: AppError = new Error('Client not found');
      error.statusCode = 404;
      error.code = ErrorCode.CLIENT_NOT_FOUND;
      throw error;
    }

    const existing = await prisma.department.findFirst({
      where: { clientId, code }
    });

    if (existing) {
      const error: AppError = new Error(`Department code '${code}' is already taken for this client`);
      error.statusCode = 400;
      error.code = ErrorCode.DUPLICATE_CODE;
      throw error;
    }

    return prisma.department.create({
      data: { clientId, name, code },
      include: {
        client: true
      }
    });
  }

  static async updateDepartment(id: string, name?: string, isActive?: boolean) {
    const department = await prisma.department.findUnique({
      where: { id }
    });

    if (!department) {
      const error: AppError = new Error('Department not found');
      error.statusCode = 404;
      error.code = ErrorCode.DEPARTMENT_NOT_FOUND;
      throw error;
    }

    return prisma.department.update({
      where: { id },
      data: {
        name: name !== undefined ? name : department.name,
        isActive: isActive !== undefined ? isActive : department.isActive
      },
      include: {
        client: true
      }
    });
  }

  static async deleteDepartment(id: string) {
    const department = await prisma.department.findUnique({
      where: { id }
    });

    if (!department) {
      const error: AppError = new Error('Department not found');
      error.statusCode = 404;
      error.code = ErrorCode.DEPARTMENT_NOT_FOUND;
      throw error;
    }

    return prisma.department.delete({
      where: { id }
    });
  }
}
