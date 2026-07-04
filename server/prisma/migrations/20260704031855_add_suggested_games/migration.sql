-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isSuggested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "title" TEXT;
