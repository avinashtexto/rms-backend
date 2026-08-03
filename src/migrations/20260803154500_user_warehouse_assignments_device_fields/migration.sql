-- AlterTable
ALTER TABLE "devices" ADD COLUMN "label" TEXT;
ALTER TABLE "devices" ADD COLUMN "appVersion" TEXT;
ALTER TABLE "devices" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "user_warehouse_assignments" (
    "userId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_warehouse_assignments_pkey" PRIMARY KEY ("userId","warehouseId")
);

-- AddForeignKey
ALTER TABLE "user_warehouse_assignments" ADD CONSTRAINT "user_warehouse_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_warehouse_assignments" ADD CONSTRAINT "user_warehouse_assignments_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
