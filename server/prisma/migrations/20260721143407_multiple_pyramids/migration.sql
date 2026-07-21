/*
  Warnings:

  - Added the required column `updatedAt` to the `GoatPyramid` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "GoatPyramid" DROP CONSTRAINT "GoatPyramid_userId_fkey";

-- DropIndex
DROP INDEX "GoatPyramid_userId_key";

-- AlterTable
ALTER TABLE "GoatPyramid" ADD COLUMN     "title" TEXT NOT NULL DEFAULT 'My GOAT Pyramid',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "GoatPyramid" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "GoatPyramid_userId_idx" ON "GoatPyramid"("userId");

-- AddForeignKey
ALTER TABLE "GoatPyramid" ADD CONSTRAINT "GoatPyramid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
