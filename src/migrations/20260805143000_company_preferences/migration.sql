-- AlterTable
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "preferences" JSONB NOT NULL DEFAULT '{}';
