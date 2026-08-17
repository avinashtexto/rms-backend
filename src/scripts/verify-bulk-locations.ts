import { prisma } from '../lib/prisma';
import { LocationService } from '../modules/location/location.service';

async function testBulkLocations() {
  console.log('🧪 Testing Bulk Location Creation & Management...\n');

  // Find a shelf
  const shelf = await prisma.shelf.findFirst({
    include: {
      rack: {
        include: {
          room: {
            include: {
              warehouse: true
            }
          }
        }
      }
    }
  });

  if (!shelf) throw new Error('No shelf found to test with');
  console.log(`Found Shelf: ${shelf.name} (${shelf.code}), Rack: ${shelf.rack.name}, Room: ${shelf.rack.room.name}`);

  // TEST 1: Bulk Generate Locations
  console.log('\n--- TEST 1: Bulk Generate Locations ---');
  const genResult = await LocationService.bulkGenerateLocations(
    shelf.id,
    undefined,
    'BULK',
    1,
    5,
    3
  );
  console.log('Bulk Generate Result:', genResult.message);
  console.log(`Generated ${genResult.count} locations:`);
  genResult.locations.forEach((l) => console.log(`  - ${l.name} (Barcode: ${l.barcode})`));

  const locIds = genResult.locations.map((l: any) => l.id);

  // TEST 2: Bulk Deactivate
  console.log('\n--- TEST 2: Bulk Deactivate ---');
  const deactResult = await LocationService.bulkActionLocations(locIds, 'DEACTIVATE');
  console.log('Deactivate Result:', deactResult.message);

  // TEST 3: Bulk Activate
  console.log('\n--- TEST 3: Bulk Activate ---');
  const actResult = await LocationService.bulkActionLocations(locIds, 'ACTIVATE');
  console.log('Activate Result:', actResult.message);

  // TEST 4: Bulk Import
  console.log('\n--- TEST 4: Bulk Import ---');
  const importRows = [
    { name: 'IMP-001', barcode: `TEST-IMP-001-${Date.now()}` },
    { name: 'IMP-002', barcode: `TEST-IMP-002-${Date.now()}` },
  ];
  const impResult = await LocationService.bulkImportLocations(shelf.id, importRows);
  console.log('Import Result:', impResult.message);

  const importIds = impResult.locations.map((l: any) => l.id);

  // TEST 5: Bulk Delete
  console.log('\n--- TEST 5: Bulk Delete ---');
  const delResult = await LocationService.bulkActionLocations([...locIds, ...importIds], 'DELETE');
  console.log('Delete Result:', delResult.message);

  console.log('\n🎉 ALL BULK LOCATION TESTS PASSED SUCCESSFULLY!');
}

testBulkLocations()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
