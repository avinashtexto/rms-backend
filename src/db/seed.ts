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
    // Company / tenancy
    { key: 'company:view', description: 'View companies' },
    { key: 'company:manage', description: 'Manage companies' },
    // Warehouse hierarchy
    { key: 'warehouse:view', description: 'View warehouses' },
    { key: 'warehouse:manage', description: 'Manage warehouses' },
    { key: 'branch:view', description: 'View branches' },
    { key: 'branch:manage', description: 'Manage branches' },
    { key: 'site:view', description: 'View sites' },
    { key: 'site:manage', description: 'Manage sites' },
    { key: 'storage:view', description: 'View storage structure (rooms/racks/shelves/locations)' },
    { key: 'storage:manage', description: 'Manage storage structure' },
    // Clients & departments
    { key: 'client:view', description: 'View clients' },
    { key: 'client:manage', description: 'Manage clients' },
    // Boxes & file records
    { key: 'box:view', description: 'View boxes' },
    { key: 'box:manage', description: 'Manage boxes' },
    { key: 'file:view', description: 'View file records' },
    { key: 'file:manage', description: 'Manage file records' },
    // Users
    { key: 'user:view', description: 'View users' },
    { key: 'user:manage', description: 'Manage users' },
    // Roles & permissions
    { key: 'role:view', description: 'View roles' },
    { key: 'role:manage', description: 'Manage roles and permissions' },
    { key: 'permission:view', description: 'View permissions list' },
    // Devices
    { key: 'device:view', description: 'View devices' },
    { key: 'device:manage', description: 'Manage devices' },
    // Workflows / operations
    { key: 'workflow:execute', description: 'Execute scan workflows' },
    // Reports, GPS, audit
    { key: 'report:view', description: 'View and generate reports' },
    { key: 'gps:view', description: 'View GPS tracking data' },
    { key: 'audit:view', description: 'View audit logs' },
    { key: 'audit:export', description: 'Export audit logs' },
    // Reason codes & settings
    { key: 'reason-code:view', description: 'View reason codes' },
    { key: 'reason-code:manage', description: 'Manage reason codes' },
    { key: 'settings:view', description: 'View company settings' },
    { key: 'settings:manage', description: 'Manage company settings' },
    // Notifications, sync, dashboard
    { key: 'notification:view', description: 'View notifications' },
    { key: 'sync:manage', description: 'Manage offline sync conflicts' },
    { key: 'dashboard:view', description: 'View dashboard' },
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
      passwordHash: hashedPassword,
      employeeCode: 'EMP001'
    },
    create: {
      companyId: company.id,
      roleId: roleMap[RoleName.SUPER_ADMIN],
      employeeCode: 'EMP001',
      fullName: 'System Administrator',
      email: adminEmail,
      status: 'ACTIVE',
      passwordHash: hashedPassword
    }
  });

  console.log('Created default Super Admin User:', adminUser.email);

  // Seeding Mobile Role Users
  const managerPassword = await bcrypt.hash('manager123', 10);
  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@texto.com' },
    update: { 
      passwordHash: managerPassword,
      employeeCode: 'EMPMGR'
    },
    create: {
      companyId: company.id,
      roleId: roleMap[RoleName.WAREHOUSE_MANAGER],
      employeeCode: 'EMPMGR',
      fullName: 'Warehouse Manager',
      email: 'manager@texto.com',
      status: 'ACTIVE',
      passwordHash: managerPassword
    }
  });
  console.log('Created Warehouse Manager User:', managerUser.email);

  const supervisorPassword = await bcrypt.hash('supervisor123', 10);
  const supervisorUser = await prisma.user.upsert({
    where: { email: 'supervisor@texto.com' },
    update: { 
      passwordHash: supervisorPassword,
      employeeCode: 'EMPSUP'
    },
    create: {
      companyId: company.id,
      roleId: roleMap[RoleName.SUPERVISOR],
      employeeCode: 'EMPSUP',
      fullName: 'Shift Supervisor',
      email: 'supervisor@texto.com',
      status: 'ACTIVE',
      passwordHash: supervisorPassword
    }
  });
  console.log('Created Supervisor User:', supervisorUser.email);

  const operatorPassword = await bcrypt.hash('operator123', 10);
  const operatorUser = await prisma.user.upsert({
    where: { email: 'operator@texto.com' },
    update: { 
      passwordHash: operatorPassword,
      employeeCode: 'EMPOPR'
    },
    create: {
      companyId: company.id,
      roleId: roleMap[RoleName.OPERATOR],
      employeeCode: 'EMPOPR',
      fullName: 'Floor Operator',
      email: 'operator@texto.com',
      status: 'ACTIVE',
      passwordHash: operatorPassword
    }
  });
  console.log('Created Operator User:', operatorUser.email);

  // 5. Create a Default Branch
  const branch = await prisma.branch.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: 'BR-MAIN',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      name: 'Main Branch',
      code: 'BR-MAIN',
      address: '123 Main St',
      isActive: true,
    },
  });
  console.log('Created Branch:', branch.name);

  // 6. Create a Default Site
  const site = await prisma.site.upsert({
    where: {
      branchId_code: {
        branchId: branch.id,
        code: 'ST-A',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      branchId: branch.id,
      name: 'Site A',
      code: 'ST-A',
      address: '456 Industrial Park',
      isActive: true,
    },
  });
  console.log('Created Site:', site.name);

  // 7. Create a Default Warehouse
  const warehouse = await prisma.warehouse.upsert({
    where: {
      siteId_code: {
        siteId: site.id,
        code: 'WH-1',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      siteId: site.id,
      name: 'Warehouse 1',
      code: 'WH-1',
      address: '789 Warehouse Lane',
      isActive: true,
    },
  });
  console.log('Created Warehouse:', warehouse.name);

  // 8. Create a Default Room
  const room = await prisma.room.upsert({
    where: {
      warehouseId_code: {
        warehouseId: warehouse.id,
        code: 'RM-101',
      },
    },
    update: {},
    create: {
      warehouseId: warehouse.id,
      name: 'Room 101',
      code: 'RM-101',
      isActive: true,
    },
  });
  console.log('Created Room:', room.name);

  // 9. Create a Default Rack
  const rack = await prisma.rack.upsert({
    where: {
      roomId_code: {
        roomId: room.id,
        code: 'RK-A',
      },
    },
    update: {},
    create: {
      roomId: room.id,
      name: 'Rack A',
      code: 'RK-A',
      isActive: true,
    },
  });
  console.log('Created Rack:', rack.name);

  // 10. Create a Default Shelf
  const shelf = await prisma.shelf.upsert({
    where: {
      rackId_code: {
        rackId: rack.id,
        code: 'SF-1',
      },
    },
    update: {},
    create: {
      rackId: rack.id,
      name: 'Shelf 1',
      code: 'SF-1',
      isActive: true,
    },
  });
  console.log('Created Shelf:', shelf.name);

  // 11. Create a Default Location
  const location = await prisma.location.upsert({
    where: {
      barcode: 'LOC-A-1-01',
    },
    update: {},
    create: {
      shelfId: shelf.id,
      name: 'LOC-01',
      barcode: 'LOC-A-1-01',
      isOccupied: false,
      isActive: true,
    },
  });
  console.log('Created Location:', location.name);

  // 12. Create a Default Client
  const client = await prisma.client.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: 'CL-ACME',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      name: 'Acme Corp',
      code: 'CL-ACME',
      contactEmail: 'contact@acme.com',
      isActive: true,
    },
  });
  console.log('Created Client:', client.name);

  // 13. Create a Default Department
  const department = await prisma.department.upsert({
    where: {
      clientId_code: {
        clientId: client.id,
        code: 'DEPT-HR',
      },
    },
    update: {},
    create: {
      clientId: client.id,
      name: 'Human Resources',
      code: 'DEPT-HR',
      isActive: true,
    },
  });
  console.log('Created Department:', department.name);

  // 14. Create Reason Codes
  const reasonCodeOverride = await prisma.reasonCode.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: 'OVERRIDE_DAMAGED',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      code: 'OVERRIDE_DAMAGED',
      label: 'Damaged barcode/label',
      appliesTo: 'LOCATION_OVERRIDE',
      isActive: true,
    },
  });
  console.log('Created Reason Code:', reasonCodeOverride.code);

  const reasonCodeReject = await prisma.reasonCode.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: 'REJECT_WRONG_BOX',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      code: 'REJECT_WRONG_BOX',
      label: 'Item does not belong to this box',
      appliesTo: 'REFILE_REJECT',
      isActive: true,
    },
  });
  console.log('Created Reason Code:', reasonCodeReject.code);

  // 15. Create a Default Box stored at the location
  const box = await prisma.box.upsert({
    where: {
      barcode: 'BOX-000001',
    },
    update: {},
    create: {
      companyId: company.id,
      clientId: client.id,
      departmentId: department.id,
      barcode: 'BOX-000001',
      status: 'ACTIVE',
      description: 'Sample HR Employee Records',
      currentLocationId: location.id,
    },
  });
  console.log('Created Box:', box.barcode);

  // Mark the location as occupied
  await prisma.location.update({
    where: { id: location.id },
    data: { isOccupied: true }
  });

  // 16. Create Default FileRecords
  const file1 = await prisma.fileRecord.upsert({
    where: {
      barcode: 'FILE-000001',
    },
    update: {},
    create: {
      companyId: company.id,
      boxId: box.id,
      barcode: 'FILE-000001',
      title: '2025 W2 Tax Forms',
      status: 'ACTIVE',
    },
  });
  console.log('Created FileRecord:', file1.barcode);

  const file2 = await prisma.fileRecord.upsert({
    where: {
      barcode: 'FILE-000002',
    },
    update: {},
    create: {
      companyId: company.id,
      boxId: box.id,
      barcode: 'FILE-000002',
      title: 'HR Policy Handbook Signoffs',
      status: 'ACTIVE',
    },
  });
  console.log('Created FileRecord:', file2.barcode);

  const file3 = await prisma.fileRecord.upsert({
    where: {
      barcode: 'FILE-000003',
    },
    update: {},
    create: {
      companyId: company.id,
      boxId: box.id,
      barcode: 'FILE-000003',
      title: 'Employee Performance Reviews 2024',
      status: 'ACTIVE',
    },
  });
  console.log('Created FileRecord:', file3.barcode);

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
