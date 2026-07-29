import { prisma } from "../../lib/prisma.js"


const TEAMS = [
  { id: 1610612737, abbreviation: "ATL", city: "Atlanta", name: "Hawks" },
  { id: 1610612738, abbreviation: "BOS", city: "Boston", name: "Celtics" },
  { id: 1610612751, abbreviation: "BKN", city: "Brooklyn", name: "Nets" },
  { id: 1610612766, abbreviation: "CHA", city: "Charlotte", name: "Hornets" },
  { id: 1610612741, abbreviation: "CHI", city: "Chicago", name: "Bulls" },
  { id: 1610612739, abbreviation: "CLE", city: "Cleveland", name: "Cavaliers" },
  { id: 1610612742, abbreviation: "DAL", city: "Dallas", name: "Mavericks" },
  { id: 1610612743, abbreviation: "DEN", city: "Denver", name: "Nuggets" },
  { id: 1610612765, abbreviation: "DET", city: "Detroit", name: "Pistons" },
  { id: 1610612744, abbreviation: "GSW", city: "Golden State", name: "Warriors" },
  { id: 1610612745, abbreviation: "HOU", city: "Houston", name: "Rockets" },
  { id: 1610612754, abbreviation: "IND", city: "Indiana", name: "Pacers" },
  { id: 1610612746, abbreviation: "LAC", city: "Los Angeles", name: "Clippers" },
  { id: 1610612747, abbreviation: "LAL", city: "Los Angeles", name: "Lakers" },
  { id: 1610612763, abbreviation: "MEM", city: "Memphis", name: "Grizzlies" },
  { id: 1610612748, abbreviation: "MIA", city: "Miami", name: "Heat" },
  { id: 1610612749, abbreviation: "MIL", city: "Milwaukee", name: "Bucks" },
  { id: 1610612750, abbreviation: "MIN", city: "Minnesota", name: "Timberwolves" },
  { id: 1610612740, abbreviation: "NOP", city: "New Orleans", name: "Pelicans" },
  { id: 1610612752, abbreviation: "NYK", city: "New York", name: "Knicks" },
  { id: 1610612760, abbreviation: "OKC", city: "Oklahoma City", name: "Thunder" },
  { id: 1610612753, abbreviation: "ORL", city: "Orlando", name: "Magic" },
  { id: 1610612755, abbreviation: "PHI", city: "Philadelphia", name: "76ers" },
  { id: 1610612756, abbreviation: "PHX", city: "Phoenix", name: "Suns" },
  { id: 1610612757, abbreviation: "POR", city: "Portland", name: "Trail Blazers" },
  { id: 1610612758, abbreviation: "SAC", city: "Sacramento", name: "Kings" },
  { id: 1610612759, abbreviation: "SAS", city: "San Antonio", name: "Spurs" },
  { id: 1610612761, abbreviation: "TOR", city: "Toronto", name: "Raptors" },
  { id: 1610612762, abbreviation: "UTA", city: "Utah", name: "Jazz" },
  { id: 1610612764, abbreviation: "WAS", city: "Washington", name: "Wizards" },
]

async function main() {
  const existing = await prisma.team.findMany({ select: { id: true } })
  const known = new Set(existing.map((t) => t.id))

  let updated = 0
  let missing = 0

  for (const t of TEAMS) {
    if (!known.has(t.id)) {
      missing++
      continue
    }
    await prisma.team.update({
      where: { id: t.id },
      // Only fill abbreviation + city. Leave `name` as-is — your fetch stores
      // the short name ("Lakers"), and overwriting it here isn't the job.
      data: { abbreviation: t.abbreviation, city: t.city },
    })
    updated++
  }

  console.log(`Updated ${updated} team(s).`)
  if (missing) {
    console.log(
      `${missing} of 30 teams aren't in the DB yet — they'll get abbreviations ` +
        `the next time you run this after they've appeared in a game.`
    )
  }
}

main()
  .catch((e) => {
    console.error("seedTeams failed:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())