-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('INTAKE', 'FRESH_BOX', 'INVENTORY', 'REFILE', 'SEGREGATION', 'LOOKUP');

-- CreateEnum
CREATE TYPE "WarningCode" AS ENUM ('BOX_OVER_CAPACITY', 'DUPLICATE_SCAN', 'CAPACITY_EXCEEDED');

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN "barcode" TEXT;

-- AlterTable
ALTER TABLE "racks" ADD COLUMN "barcode" TEXT;

-- AlterTable
ALTER TABLE "boxes" ADD COLUMN "fileCapacity" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "rooms_barcode_key" ON "rooms"("barcode");

-- CreateIndex
CREATE INDEX "rooms_barcode_idx" ON "rooms"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "racks_barcode_key" ON "racks"("barcode");

-- CreateIndex
CREATE INDEX "racks_barcode_idx" ON "racks"("barcode");
