import { prisma } from '../../lib/prisma';

export class VendorService {
  static async list(companyId: string) {
    return prisma.vendor.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async create(companyId: string, data: { name: string; code: string; contactEmail?: string; phone?: string; address?: string }) {
    const existing = await prisma.vendor.findFirst({
      where: { companyId, code: data.code }
    });
    if (existing) throw new Error(`Vendor '${data.code}' already exists`);

    return prisma.vendor.create({
      data: {
        companyId,
        name: data.name,
        code: data.code,
        contactEmail: data.contactEmail,
        phone: data.phone,
        address: data.address
      }
    });
  }

  static async update(id: string, data: Partial<{ name: string; contactEmail: string; phone: string; address: string; isActive: boolean }>) {
    return prisma.vendor.update({
      where: { id },
      data
    });
  }

  static async delete(id: string) {
    return prisma.vendor.delete({ where: { id } });
  }
}
