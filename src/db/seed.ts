import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { RoleName } from '@prisma/client';

async function main() {
  console.log('Seeding database with default Company, Roles, Permissions, and Admin...');

  // 1. Create a Default Company
  const company = await prisma.company.upsert({
    where: { code: 'TS' },
    update: {},
    create: {
      name: 'Texto Software PVT LTD',
      code: 'TS',
      isActive: true,
    },
  });
  console.log('Created Company:', company.name);

  // 2. Define Permissions to Seed
  const permissions = [
    { key: 'company:view', description: 'View companies' },
    { key: 'company:manage', description: 'Manage companies' },
    { key: 'warehouse:view', description: 'View warehouses' },
    { key: 'warehouse:manage', description: 'Manage warehouses' },
    { key: 'role:view', description: 'View roles' },
    { key: 'role:manage', description: 'Manage roles and permissions' },
    { key: 'permission:view', description: 'View permissions list' },
    { key: 'user:view', description: 'View users' },
    { key: 'user:manage', description: 'Manage users' }
  ];

  const dbPermissions: any[] = [];
  for (const p of permissions) {
    const perm = await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: { key: p.key, description: p.description }
    });
    dbPermissions.push(perm);
  }
  console.log(`Seeded ${dbPermissions.length} permissions.`);

  // 3. Create Roles for the Company
  const rolesToCreate = [
    { name: RoleName.SUPER_ADMIN, label: 'Super Administrator' },
    { name: RoleName.COMPANY_ADMIN, label: 'Company Administrator' },
    { name: RoleName.WAREHOUSE_MANAGER, label: 'Warehouse Manager' },
    { name: RoleName.SUPERVISOR, label: 'Supervisor' },
    { name: RoleName.OPERATOR, label: 'Operator' },
    { name: RoleName.VIEWER, label: 'Viewer' },
  ];

  const roleMap: Record<string, string> = {};

  for (const roleData of rolesToCreate) {
    const role = await prisma.role.upsert({
      where: {
        companyId_name: {
          companyId: company.id,
          name: roleData.name,
        },
      },
      update: { label: roleData.label },
      create: {
        companyId: company.id,
        name: roleData.name,
        label: roleData.label,
      },
    });
    roleMap[roleData.name] = role.id;
    console.log(`Created/Verified Role ${roleData.name}`);

    // Assign all seeded permissions to SUPER_ADMIN and COMPANY_ADMIN
    if (roleData.name === RoleName.SUPER_ADMIN || roleData.name === RoleName.COMPANY_ADMIN) {
      for (const perm of dbPermissions) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: perm.id
            }
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: perm.id
          }
        });
      }
    }
  }

  // 4. Create default Super Admin User
  const adminEmail = 'admin@texto.com';
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: hashedPassword
    },
    create: {
      companyId: company.id,
      roleId: roleMap[RoleName.SUPER_ADMIN],
      employeeCode: 'EMP-001',
      fullName: 'System Administrator',
      email: adminEmail,
      status: 'ACTIVE',
      passwordHash: hashedPassword
    }
  });

  console.log('Created default Super Admin User:', adminUser.email);
  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
