-- CreateEnum
CREATE TYPE "WarehouseTemplateType" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'CUSTOM');
CREATE TYPE "LocationNamingMode" AS ENUM ('AUTO', 'MANUAL');
CREATE TYPE "MasterRecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterEnum
ALTER TYPE "WorkflowAction" ADD VALUE IF NOT EXISTS 'RACK_TEMPLATE_CREATED';
ALTER TYPE "WorkflowAction" ADD VALUE IF NOT EXISTS 'RACK_TEMPLATE_UPDATED';
ALTER TYPE "WorkflowAction" ADD VALUE IF NOT EXISTS 'RACK_TEMPLATE_DELETED';
ALTER TYPE "WorkflowAction" ADD VALUE IF NOT EXISTS 'RACK_TEMPLATE_CLONED';
ALTER TYPE "WorkflowAction" ADD VALUE IF NOT EXISTS 'RACK_TEMPLATE_APPLIED';
ALTER TYPE "WorkflowAction" ADD VALUE IF NOT EXISTS 'RACK_TEMPLATE_PREVIEWED';

-- AlterTable
ALTER TABLE "rack_templates" ADD COLUMN IF NOT EXISTS "warehouseType" "WarehouseTemplateType" NOT NULL DEFAULT 'CUSTOM';
ALTER TABLE "rack_templates" ADD COLUMN IF NOT EXISTS "locationPerLevel" INTEGER;
ALTER TABLE "rack_templates" ADD COLUMN IF NOT EXISTS "rowPrefix" TEXT NOT NULL DEFAULT 'ROW';
ALTER TABLE "rack_templates" ADD COLUMN IF NOT EXISTS "rackPrefix" TEXT NOT NULL DEFAULT 'R';
ALTER TABLE "rack_templates" ADD COLUMN IF NOT EXISTS "levelPrefix" TEXT NOT NULL DEFAULT 'L';
ALTER TABLE "rack_templates" ADD COLUMN IF NOT EXISTS "locationPrefix" TEXT NOT NULL DEFAULT 'LOC';
ALTER TABLE "rack_templates" ADD COLUMN IF NOT EXISTS "locationPadding" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "rack_templates" ADD COLUMN IF NOT EXISTS "locationNaming" "LocationNamingMode" NOT NULL DEFAULT 'AUTO';
ALTER TABLE "rack_templates" ADD COLUMN IF NOT EXISTS "status" "MasterRecordStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "rack_templates" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "rack_templates" ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;
ALTER TABLE "rack_templates" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Unique name per company (ignore soft-deleted duplicates via partial index if needed)
CREATE UNIQUE INDEX IF NOT EXISTS "rack_templates_companyId_name_key" ON "rack_templates"("companyId", "name") WHERE "deletedAt" IS NULL;
