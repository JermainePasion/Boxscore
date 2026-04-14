/*
  Warnings:

  - Added the required column `teamId` to the `GameStat` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GameStat" ADD COLUMN     "teamId" INTEGER NOT NULL;
