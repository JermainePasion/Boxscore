-- DropForeignKey
ALTER TABLE "GoatPyramidPlayer" DROP CONSTRAINT "GoatPyramidPlayer_pyramidId_fkey";

-- CreateTable
CREATE TABLE "FavoriteGame" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "FavoriteGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteGame_userId_idx" ON "FavoriteGame"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteGame_userId_gameId_key" ON "FavoriteGame"("userId", "gameId");

-- AddForeignKey
ALTER TABLE "GoatPyramidPlayer" ADD CONSTRAINT "GoatPyramidPlayer_pyramidId_fkey" FOREIGN KEY ("pyramidId") REFERENCES "GoatPyramid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteGame" ADD CONSTRAINT "FavoriteGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteGame" ADD CONSTRAINT "FavoriteGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
