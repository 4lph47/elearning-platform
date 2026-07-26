-- CreateTable
CREATE TABLE "ResaleBundleListing" (
    "id" TEXT NOT NULL,
    "resaleBundleId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,

    CONSTRAINT "ResaleBundleListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResaleBundleListing_resaleBundleId_listingId_key" ON "ResaleBundleListing"("resaleBundleId", "listingId");

-- CreateIndex
CREATE INDEX "ResaleBundleListing_listingId_idx" ON "ResaleBundleListing"("listingId");

-- AddForeignKey
ALTER TABLE "ResaleBundleListing" ADD CONSTRAINT "ResaleBundleListing_resaleBundleId_fkey" FOREIGN KEY ("resaleBundleId") REFERENCES "ResaleBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResaleBundleListing" ADD CONSTRAINT "ResaleBundleListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ResaleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing 1:1 bundle memberships into the new join table before
-- dropping the old column, so no existing bundle loses its courses.
INSERT INTO "ResaleBundleListing" ("id", "resaleBundleId", "listingId")
SELECT md5(random()::text || clock_timestamp()::text || "id"), "resaleBundleId", "id"
FROM "ResaleListing"
WHERE "resaleBundleId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "ResaleListing" DROP CONSTRAINT "ResaleListing_resaleBundleId_fkey";

-- DropIndex
DROP INDEX "ResaleListing_resaleBundleId_idx";

-- AlterTable
ALTER TABLE "ResaleListing" DROP COLUMN "resaleBundleId";
