/*
  Warnings:

  - Added the required column `watchedBefore` to the `GameReview` table without a default value. This is not possible if the table is not empty.
  - Made the column `minutes` on table `GameStat` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "GameReview" ADD COLUMN     "watchedAt" TIMESTAMP(3),
ADD COLUMN     "watchedBefore" BOOLEAN NOT NULL;

-- AlterTable
ALTER TABLE "GameStat" ALTER COLUMN "minutes" SET NOT NULL;
