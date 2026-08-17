import { prisma } from '../lib/prisma';
import { AuthService } from '../modules/auth/auth.service';
import { CompanyService } from '../modules/company/company.service';
import { WarehouseService } from '../modules/warehouse/warehouse.service';
import { RoleName } from '@prisma/client';

async function runVerification() {
  console.log('==================================================');
  console.log('RUNNING RMS ADMIN CREDENTIAL & LOGIN E2E VERIFICATION');
  console.log('==================================================\n');

  const testCompanyCode = `TCO${Date.now().toString().slice(-4)}`;
  const companyAdminEmail = `company.admin.${Date.now()}@testabc.com`;
  const companyAdminPassword = 'TestPassword@123';

  const warehouseAdminEmail = `warehouse.admin.${Date.now()}@testabc.com`;
  const warehouseAdminPassword = 'TestPassword@123';

  let createdCompanyId: string | null = null;
  let createdWarehouseId: string | null = null;

  try {
    // -----------------------------------------------------------------
    // TEST 1: Super Admin creates Company + Company Admin Credentials
    // -----------------------------------------------------------------
    console.log('[TEST 1] Creating Company + Company Admin in one transaction...');
    const companyResult = await CompanyService.createCompany(
      `Test Company ${testCompanyCode}`,
      testCompanyCode,
      true,
      {
        fullName: 'Test Company Admin',
        email: companyAdminEmail,
        password: companyAdminPassword,
        phone: '+1234567890'
      }
    );
    createdCompanyId = companyResult.id;
    console.log(`✓ Company created: id=${companyResult.id}, code=${companyResult.code}`);
    console.log(`✓ Company Admin created: email=${companyResult.admin?.email}, role=${companyResult.admin?.role}`);

    console.log('[TEST 1] Logging in with newly created Company Admin credentials...');
    const companyLogin = await AuthService.login(companyAdminEmail, companyAdminPassword);
    console.log(`✓ Company Admin Login successful!`);
    console.log(`  - Role: ${companyLogin.user.role}`);
    console.log(`  - CompanyId: ${companyLogin.user.companyId}`);
    console.log(`  - Name: ${companyLogin.user.name}`);
    if (companyLogin.user.role !== RoleName.COMPANY_ADMIN || companyLogin.user.companyId !== createdCompanyId) {
      throw new Error('TEST 1 FAILED: Incorrect role or companyId returned for Company Admin');
    }
    console.log('✓ TEST 1 PASSED!\n');

    // -----------------------------------------------------------------
    // Setup Branch & Site for Warehouse
    // -----------------------------------------------------------------
    console.log('[SETUP] Creating Branch and Site for the Company...');
    const branch = await prisma.branch.create({
      data: {
        companyId: createdCompanyId,
        name: 'Test Branch 01',
        code: `BR${Date.now().toString().slice(-4)}`
      }
    });

    const site = await prisma.site.create({
      data: {
        companyId: createdCompanyId,
        branchId: branch.id,
        name: 'Test Site 01',
        code: `ST${Date.now().toString().slice(-4)}`
      }
    });
    console.log(`✓ Branch (${branch.id}) and Site (${site.id}) created.`);

    // -----------------------------------------------------------------
    // TEST 2: Create Warehouse + Warehouse Admin Credentials
    // -----------------------------------------------------------------
    console.log('\n[TEST 2] Creating Warehouse + Warehouse Admin in one transaction...');
    const whCode = `WH${Date.now().toString().slice(-3)}`;
    const warehouseResult = await WarehouseService.createWarehouse(
      createdCompanyId,
      site.id,
      `Test Warehouse ${whCode}`,
      whCode,
      '123 Industrial St',
      'Metropolis',
      'NY',
      'USA',
      10001,
      '+1987654321',
      true,
      {
        fullName: 'Test Warehouse Admin',
        email: warehouseAdminEmail,
        password: warehouseAdminPassword,
        phone: '+1987654321'
      }
    );
    createdWarehouseId = warehouseResult.id;
    console.log(`✓ Warehouse created: id=${warehouseResult.id}, code=${warehouseResult.code}`);
    console.log(`✓ Warehouse Admin created: email=${warehouseResult.admin?.email}, role=${warehouseResult.admin?.role}, warehouseId=${warehouseResult.admin?.warehouseId}`);

    console.log('[TEST 2] Logging in with newly created Warehouse Admin credentials...');
    const whLogin = await AuthService.login(warehouseAdminEmail, warehouseAdminPassword);
    console.log(`✓ Warehouse Admin Login successful!`);
    console.log(`  - Role: ${whLogin.user.role}`);
    console.log(`  - CompanyId: ${whLogin.user.companyId}`);
    console.log(`  - WarehouseId: ${whLogin.user.warehouseId}`);
    console.log(`  - Warehouse Name: ${whLogin.warehouse?.name}`);

    if (whLogin.user.role !== RoleName.WAREHOUSE_MANAGER || whLogin.user.warehouseId !== createdWarehouseId) {
      throw new Error('TEST 2 FAILED: Incorrect role or warehouseId returned for Warehouse Admin');
    }
    console.log('✓ TEST 2 PASSED!\n');

    // -----------------------------------------------------------------
    // TEST 3: Duplicate Email Validation
    // -----------------------------------------------------------------
    console.log('[TEST 3] Testing duplicate email prevention during creation...');
    let duplicateCaught = false;
    try {
      await CompanyService.createCompany(
        'Duplicate Email Co',
        `DUP${Date.now().toString().slice(-4)}`,
        true,
        {
          fullName: 'Duplicate User',
          email: companyAdminEmail, // Existing email
          password: 'Password123'
        }
      );
    } catch (err: any) {
      duplicateCaught = true;
      console.log(`✓ Correctly caught duplicate email error: "${err.message}"`);
    }
    if (!duplicateCaught) {
      throw new Error('TEST 3 FAILED: Duplicate email was not blocked!');
    }
    console.log('✓ TEST 3 PASSED!\n');

    // -----------------------------------------------------------------
    // TEST 4: Deactivate Warehouse -> Warehouse Admin login blocked
    // -----------------------------------------------------------------
    console.log('[TEST 4] Deactivating Warehouse and testing Warehouse Admin login rejection...');
    await prisma.warehouse.update({
      where: { id: createdWarehouseId },
      data: { isActive: false }
    });

    let deactivatedLoginBlocked = false;
    try {
      await AuthService.login(warehouseAdminEmail, warehouseAdminPassword);
    } catch (err: any) {
      deactivatedLoginBlocked = true;
      console.log(`✓ Correctly rejected login for deactivated warehouse: "${err.message}"`);
    }
    if (!deactivatedLoginBlocked) {
      throw new Error('TEST 4 FAILED: Inactive warehouse admin was allowed to login!');
    }
    console.log('✓ TEST 4 PASSED!\n');

    // -----------------------------------------------------------------
    // TEST 5: Deactivate Company -> Company Admin login blocked
    // -----------------------------------------------------------------
    console.log('[TEST 5] Deactivating Company and testing Company Admin login rejection...');
    await prisma.company.update({
      where: { id: createdCompanyId },
      data: { isActive: false }
    });

    let deactivatedCompanyBlocked = false;
    try {
      await AuthService.login(companyAdminEmail, companyAdminPassword);
    } catch (err: any) {
      deactivatedCompanyBlocked = true;
      console.log(`✓ Correctly rejected login for deactivated company: "${err.message}"`);
    }
    if (!deactivatedCompanyBlocked) {
      throw new Error('TEST 5 FAILED: Inactive company admin was allowed to login!');
    }
    console.log('✓ TEST 5 PASSED!\n');

    console.log('==================================================');
    console.log('ALL 5 E2E INTEGRATION & CREDENTIAL TESTS PASSED!');
    console.log('==================================================');
  } finally {
    // Cleanup test data
    console.log('\n[CLEANUP] Cleaning up test records...');
    if (createdWarehouseId) {
      await prisma.userWarehouseAssignment.deleteMany({ where: { warehouseId: createdWarehouseId } });
      await prisma.auditLog.deleteMany({ where: { warehouseId: createdWarehouseId } });
      await prisma.warehouse.deleteMany({ where: { id: createdWarehouseId } });
    }
    if (createdCompanyId) {
      await prisma.refreshToken.deleteMany({ where: { user: { companyId: createdCompanyId } } });
      await prisma.auditLog.deleteMany({ where: { companyId: createdCompanyId } });
      await prisma.user.deleteMany({ where: { companyId: createdCompanyId } });
      await prisma.site.deleteMany({ where: { companyId: createdCompanyId } });
      await prisma.branch.deleteMany({ where: { companyId: createdCompanyId } });
      await prisma.company.deleteMany({ where: { id: createdCompanyId } });
    }
    console.log('✓ Cleanup complete.');
  }
}

runVerification()
  .catch((err) => {
    console.error('VERIFICATION SCRIPT FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
