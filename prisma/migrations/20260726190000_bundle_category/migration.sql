-- AlterTable
ALTER TABLE "Bundle" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Outros';

-- AlterTable
ALTER TABLE "ResaleBundle" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Outros';

-- Backfill existing bundles with the category of their first course, so
-- they don't all start bucketed under "Outros" in the category filters.
UPDATE "Bundle" b
SET "category" = c."category"
FROM "Course" c
WHERE c."bundleId" = b."id"
  AND b."category" = 'Outros';

UPDATE "ResaleBundle" rb
SET "category" = c."category"
FROM "ResaleBundleListing" rbl
JOIN "ResaleListing" rl ON rl."id" = rbl."listingId"
JOIN "Course" c ON c."id" = rl."courseId"
WHERE rbl."resaleBundleId" = rb."id"
  AND rb."category" = 'Outros';
