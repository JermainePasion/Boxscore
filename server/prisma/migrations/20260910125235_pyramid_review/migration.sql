-- CreateTable
CREATE TABLE "PyramidReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pyramidId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PyramidReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PyramidReviewLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PyramidReviewLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PyramidReview_pyramidId_idx" ON "PyramidReview"("pyramidId");

-- CreateIndex
CREATE UNIQUE INDEX "PyramidReview_userId_pyramidId_key" ON "PyramidReview"("userId", "pyramidId");

-- CreateIndex
CREATE INDEX "PyramidReviewLike_reviewId_idx" ON "PyramidReviewLike"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "PyramidReviewLike_userId_reviewId_key" ON "PyramidReviewLike"("userId", "reviewId");

-- AddForeignKey
ALTER TABLE "PyramidReview" ADD CONSTRAINT "PyramidReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PyramidReview" ADD CONSTRAINT "PyramidReview_pyramidId_fkey" FOREIGN KEY ("pyramidId") REFERENCES "GoatPyramid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PyramidReviewLike" ADD CONSTRAINT "PyramidReviewLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PyramidReviewLike" ADD CONSTRAINT "PyramidReviewLike_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "PyramidReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
