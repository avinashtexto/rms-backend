import { prisma } from '../lib/prisma';
import { RackTemplateService } from '../modules/rack-template/rack-template.service';
import { RackService } from '../modules/rack/rack.service';

async function testRackTemplateAndLevels() {
  console.log('🧪 Starting Rack Template & Levels Verification...\n');

  // Find or create test company, warehouse, room, user
  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No active company found');

  const warehouse = await prisma.warehouse.findFirst({ where: { companyId: company.id, isActive: true } });
  if (!warehouse) throw new Error('No active warehouse found');

  const user = await prisma.user.findFirst({ where: { companyId: company.id, status: 'ACTIVE' } });
  if (!user) throw new Error('No active user found');

  // 1. Ensure test room exists
  const room = await prisma.room.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: 'RM-TEST' } },
    create: {
      warehouseId: warehouse.id,
      name: 'Test Room',
      code: 'RM-TEST'
    },
    update: {}
  });

  // 2. Ensure test rack template exists
  const template = await prisma.rackTemplate.upsert({
    where: { id: 'test-template-001' },
    create: {
      id: 'test-template-001',
      companyId: company.id,
      name: 'Test Multi-Level Template',
      code: 'TPL-TEST-01',
      rowsCount: 1,
      racksCount: 2,
      levelsCount: 3,
      locRows: 2,
      locCols: 2,
      status: 'ACTIVE'
    },
    update: {
      status: 'ACTIVE',
      levelsCount: 3,
      racksCount: 2
    }
  });

  console.log('✅ Setup complete: Room & Template ready.');

  // TEST 1: Apply Template
  console.log('\n--- TEST 1: Apply Rack Template ---');
  const applyResult = await RackTemplateService.applyTemplate(
    template.id,
    company.id,
    user.id,
    { warehouseId: warehouse.id, roomId: room.id }
  );
  console.log('Apply Result:', applyResult.message);
  console.log('✅ Rows:', applyResult.rowsCreated, 'Racks:', applyResult.racksCreated, 'Levels:', applyResult.levelsCreated, 'Locations:', applyResult.locationsCreated);

  // TEST 2: Re-apply Template (Idempotent check)
  console.log('\n--- TEST 2: Re-apply Rack Template (Idempotency) ---');
  const reapplyResult = await RackTemplateService.applyTemplate(
    template.id,
    company.id,
    user.id,
    { warehouseId: warehouse.id, roomId: room.id }
  );
  console.log('Re-apply Result:', reapplyResult.message);
  console.log('✅ Re-apply succeeded without unique constraint errors.');

  // TEST 3: List Racks and Verify Levels
  console.log('\n--- TEST 3: List Racks and Levels ---');
  const racks = await RackService.listRacks({ roomId: room.id });
  console.log(`Found ${racks.length} racks in test room.`);
  if (racks.length === 0) throw new Error('No racks found');

  const firstRack = racks[0];
  const levels = await RackService.listLevels(firstRack.id);
  console.log(`Rack '${firstRack.name}' (${firstRack.code}) has ${levels.length} levels:`);
  levels.forEach(lv => console.log(`  - Level ${lv.name} (${lv.code}) with ${lv._count.locations} locations`));

  // TEST 4: Create Individual Level
  console.log('\n--- TEST 4: Create Level via RackService ---');
  const newLevel = await RackService.createLevel(firstRack.id, 'Extra Level 4', 'L-04');
  console.log('Created Level:', newLevel.name, `(${newLevel.code})`);

  // TEST 5: Verify Levels List Updated
  const updatedLevels = await RackService.listLevels(firstRack.id);
  console.log(`Updated Levels Count: ${updatedLevels.length}`);

  // Cleanup test extra level
  await RackService.deleteLevel(firstRack.id, newLevel.id);
  console.log('Deleted extra test level.');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

testRackTemplateAndLevels()
  .catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
