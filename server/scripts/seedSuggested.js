
try {
  await import("dotenv/config")
} catch {
  /* env already provided (e.g. by Docker) */
}

const { seedSuggested } = await import("../src/controllers/gameController.js")
const { prisma } = await import("../lib/prisma.js")

let exitCode = 0
try {
  const result = await seedSuggested()
  const failed = result.seeded.filter((r) => r.status === "failed")
  console.log(
    `\nDone: ${result.seeded.length - failed.length} suggested, ${failed.length} failed, ` +
      `${result.unsuggested} removed from suggestions.`
  )
  if (failed.length) {
    console.log("Failed games (run again later to retry):")
    for (const f of failed) console.log(`  ${f.gameId}  ${f.title}: ${f.reason}`)
    exitCode = 1
  }
} catch (err) {
  console.error("Seeding failed:", err.message)
  exitCode = 1
} finally {
  await prisma.$disconnect()
}
process.exit(exitCode)