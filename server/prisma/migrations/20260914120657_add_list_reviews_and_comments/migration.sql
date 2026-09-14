-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "listId" TEXT;

-- CreateTable
CREATE TABLE "ListReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListReviewLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListReviewLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListReview_listId_idx" ON "ListReview"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "ListReview_userId_listId_key" ON "ListReview"("userId", "listId");

-- CreateIndex
CREATE INDEX "ListReviewLike_reviewId_idx" ON "ListReviewLike"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "ListReviewLike_userId_reviewId_key" ON "ListReviewLike"("userId", "reviewId");

-- CreateIndex
CREATE INDEX "Comment_listId_idx" ON "Comment"("listId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_listId_fkey" FOREIGN KEY ("listId") REFERENCES "GameList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListReview" ADD CONSTRAINT "ListReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListReview" ADD CONSTRAINT "ListReview_listId_fkey" FOREIGN KEY ("listId") REFERENCES "GameList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListReviewLike" ADD CONSTRAINT "ListReviewLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListReviewLike" ADD CONSTRAINT "ListReviewLike_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ListReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
