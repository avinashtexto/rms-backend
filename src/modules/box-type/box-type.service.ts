import { prisma } from '../../lib/prisma';

export class BoxTypeService {
  static async list(companyId: string) {
    return prisma.boxType.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async create(companyId: string, data: { name: string; code: string; description?: string; defaultCapacity?: number }) {
    const existing = await prisma.boxType.findFirst({
      where: { companyId, code: data.code }
    });
    if (existing) throw new Error(`Box type '${data.code}' already exists`);

    return prisma.boxType.create({
      data: {
        companyId,
        name: data.name,
        code: data.code,
        description: data.description,
        defaultCapacity: data.defaultCapacity || 25
      }
    });
  }

  static async update(id: string, data: Partial<{ name: string; description: string; defaultCapacity: number; isActive: boolean }>) {
    return prisma.boxType.update({
      where: { id },
      data
    });
  }

  static async delete(id: string) {
    return prisma.boxType.delete({ where: { id } });
  }
}
