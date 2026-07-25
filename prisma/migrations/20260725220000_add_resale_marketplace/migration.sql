-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "resaleMinCommission" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ResaleBundle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sellerId" TEXT NOT NULL,

    CONSTRAINT "ResaleBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResaleListing" (
    "id" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sellerId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "resaleBundleId" TEXT,

    CONSTRAINT "ResaleListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResaleSale" (
    "id" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "instructorCut" DOUBLE PRECISION NOT NULL,
    "sellerCut" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "resaleBundleId" TEXT,

    CONSTRAINT "ResaleSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResaleBundle_sellerId_idx" ON "ResaleBundle"("sellerId");

-- CreateIndex
CREATE INDEX "ResaleListing_courseId_idx" ON "ResaleListing"("courseId");

-- CreateIndex
CREATE INDEX "ResaleListing_resaleBundleId_idx" ON "ResaleListing"("resaleBundleId");

-- CreateIndex
CREATE UNIQUE INDEX "ResaleListing_sellerId_courseId_key" ON "ResaleListing"("sellerId", "courseId");

-- CreateIndex
CREATE INDEX "ResaleSale_listingId_idx" ON "ResaleSale"("listingId");

-- CreateIndex
CREATE INDEX "ResaleSale_buyerId_idx" ON "ResaleSale"("buyerId");

-- CreateIndex
CREATE INDEX "ResaleSale_resaleBundleId_idx" ON "ResaleSale"("resaleBundleId");

-- AddForeignKey
ALTER TABLE "ResaleBundle" ADD CONSTRAINT "ResaleBundle_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResaleListing" ADD CONSTRAINT "ResaleListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResaleListing" ADD CONSTRAINT "ResaleListing_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResaleListing" ADD CONSTRAINT "ResaleListing_resaleBundleId_fkey" FOREIGN KEY ("resaleBundleId") REFERENCES "ResaleBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResaleSale" ADD CONSTRAINT "ResaleSale_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ResaleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResaleSale" ADD CONSTRAINT "ResaleSale_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResaleSale" ADD CONSTRAINT "ResaleSale_resaleBundleId_fkey" FOREIGN KEY ("resaleBundleId") REFERENCES "ResaleBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
