/*
 * Run the game sync by hand, from the server folder:
 *
 *   node scripts/syncGames.js                      last 3 days, regular season + playoffs
 *   node scripts/syncGames.js --days 7
 *   node scripts/syncGames.js --days 2 --types 001  preseason (handy for testing in October)
 *
 * In Docker:  docker compose exec web node scripts/syncGames.js --days 2 --types 001
 */
try {
  await import("dotenv/config")
} catch {
  /* env already provided (e.g. by Docker) */
}

const { syncFinishedGames } = await import("../lib/gameSync.js")
const { prisma } = await import("../lib/prisma.js")

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

const options = {}
if (arg("days")) options.days = Number(arg("days"))
if (arg("types")) options.types = arg("types")
if (arg("gap")) options.gapMs = Number(arg("gap"))

let exitCode = 0
try {
  const result = await syncFinishedGames(options)
  console.log(JSON.stringify(result, null, 2))
  if (result.stopped) exitCode = 1
} catch (err) {
  console.error(err)
  exitCode = 1
} finally {
  await prisma.$disconnect()
}
process.exit(exitCode)