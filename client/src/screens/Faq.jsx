import { Link } from "react-router-dom"

const GITHUB_REPO = "https://github.com/JermainePasion/Boxscore"

function SectionRule({ label }) {
  return (
    <div className="mb-5 flex items-center gap-4">
      <h2 className="shrink-0 text-sm font-semibold uppercase tracking-widest text-white">{label}</h2>
      <div className="h-px flex-1 bg-accent-red" />
    </div>
  )
}

function Question({ q, children }) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-[15px] font-semibold text-white">{q}</h3>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-text-muted marker:text-accent-red">
        {children}
      </ul>
    </div>
  )
}

const A = ({ to, children }) => (
  <Link to={to} className="text-gold hover:underline">
    {children}
  </Link>
)

export default function Faq() {
  return (
    <div className="mx-auto max-w-2xl pb-24">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-wide text-white md:text-4xl">FAQ</h1>
      </div>

      {/* ── About ─────────────────────────────────────────────── */}
      <section className="mb-10">
        <SectionRule label="About BoxScore" />

        <Question q="What is BoxScore?">
          <li>A place to log, rate and review NBA games, a bit like Letterboxd but for basketball.</li>
          <li>It's free, with no ads.</li>
        </Question>

        <Question q="Who made it?">
          <li>
            BoxScore is a fan-made project by a software developer who loves basketball, built as part of
            a personal portfolio.
          </li>
          <li>It's run by one person in their spare time, so expect the occasional rough edge.</li>
          <li>
            The code is public on{" "}
            <a href={GITHUB_REPO} target="_blank" rel="noreferrer" className="text-gold hover:underline">
              GitHub
            </a>
            , which is also the place to report bugs or suggest features.
          </li>
        </Question>

        <Question q="Is this an official NBA site?">
          <li>No. BoxScore is not affiliated with, endorsed by or connected to the NBA or any of its teams.</li>
          <li>
            Game data comes from the NBA's public stats site through the open-source nba_api library.
            Highlight videos are embedded from the NBA's official YouTube channel.
          </li>
          <li>NBA and team names, logos and videos belong to their respective owners.</li>
        </Question>
      </section>

      {/* ── Main features ─────────────────────────────────────── */}
      <section className="mb-10">
        <SectionRule label="Main features" />

        <Question q="Where do I find the latest games?">
          <li>The home page shows the most recently finished NBA games, plus suggested and popular games.</li>
          <li>
            New games are added twice a day, at about 2:30 PM and 9:00 PM Philippine time, after that night's
            NBA games have finished.
          </li>
          <li>The <A to="/games">Games</A> page has suggested classics and a random mix of games to discover.</li>
        </Question>

        <Question q="What's on a game's page?">
          <li><strong className="text-white">Box Score:</strong> every player's minutes, points, rebounds, assists, steals and blocks.</li>
          <li><strong className="text-white">Game Leaders:</strong> each team's top scorer, rebounder and passer.</li>
          <li><strong className="text-white">Game Charts:</strong> a shot chart of every made and missed shot, filterable by quarter.</li>
          <li><strong className="text-white">Reviews:</strong> what other fans thought, sortable by highest rated, most liked or most recent.</li>
          <li>The game's average rating and how the ratings are spread out.</li>
          <li>A button to add the game to your <A to="/watchlist">Watchlist</A> for later.</li>
        </Question>

        <Question q="How do the highlight videos work?">
          <li>When the NBA's official YouTube channel has posted full-game highlights, they play right on the game's page.</li>
          <li>For recent games, highlights are matched automatically, usually within a few hours of the game.</li>
          <li>For older games, the video is looked up the first time someone opens the game.</li>
          <li>Not every game has highlights. See Limitations below.</li>
        </Question>

        <Question q="How do reviews work?">
          <li>Rate a game from half a basketball up to five basketballs (1–10 points).</li>
          <li>Writing a review is optional; a rating on its own is fine.</li>
          <li>Add the date you watched it, or tick "I've watched this before" for a rewatch.</li>
          <li>Like and comment on other people's reviews.</li>
          <li>Everything you've rated shows up in your Diary.</li>
          <li>You need a free account to rate, review, comment or keep a watchlist.</li>
        </Question>

        <Question q="How do I search for a game?">
          <li>Use the search box at the top of the page.</li>
          <li>Search by team, month and year, player, or even a stat line, e.g. "lakers march 2026" or "curry 50 points".</li>
          <li>Search looks up games from the NBA directly, so it can take a few seconds.</li>
        </Question>

        <Question q="Can I hide the scores?">
          <li>Yes. Scores are hidden by default so you don't get spoiled before watching.</li>
          <li>Turn it off, or switch between dark and light mode, in <A to="/settings">Settings</A>.</li>
        </Question>
      </section>

      {/* ── Other features ────────────────────────────────────── */}
      <section className="mb-10">
        <SectionRule label="Other features" />

        <Question q="What is the G.O.A.T Pyramid?">
          <li>
            Build your all-time ranking of the greatest players as a five-tier pyramid: 2 players at the top,
            then 3, 4, 5 and 6.
          </li>
          <li>Pick each player's photo from a specific era of their career.</li>
          <li>Hover over or tap a player to see their stats, MVPs and championships.</li>
          <li>Others can rate, review and comment on your pyramid.</li>
          <li><A to="/pyramid">Build your pyramid</A>.</li>
        </Question>

        <Question q="What are Lists?">
          <li>Make your own collections of games, like "Best Game 7s" or "Games that made me a fan".</li>
          <li>Others can review and comment on your lists.</li>
          <li><A to="/lists">Browse lists</A>.</li>
        </Question>

        <Question q="What are Matchups?">
          <li>Pick two players and see how they did when they faced each other.</li>
          <li>See the head-to-head record, a stat comparison and every game they played against each other.</li>
          <li>Expand any game in the list to watch its highlights, when available.</li>
          <li><A to="/matchup">Compare two players</A>.</li>
        </Question>
      </section>

      {/* ── Limitations ───────────────────────────────────────── */}
      <section className="mb-10">
        <SectionRule label="Limitations" />

        <Question q="What can't BoxScore do (yet)?">
          <li>
            <strong className="text-white">No live scores.</strong> Games appear after they finish, at the next
            update (about 2:30 PM or 9:00 PM Philippine time).
          </li>
          <li>
            <strong className="text-white">Some pages are slow the first time.</strong> A game, matchup or player
            nobody has opened before is fetched from the NBA on the spot, which can take up to a minute. After
            that, it loads instantly for everyone.
          </li>
          <li>
            <strong className="text-white">NBA data is sometimes unavailable.</strong> When the NBA's site can't
            be reached, new games, searches and matchups may show "temporarily unavailable" for a while. Reviews,
            lists, pyramids and games that are already saved keep working.
          </li>
          <li>
            <strong className="text-white">Highlights aren't available for every game.</strong> They only show
            when the NBA posted full-game highlights on YouTube. Lookups for older games are also limited each
            day.
          </li>
          <li>
            <strong className="text-white">Some photos are missing.</strong> Some older players have no official
            headshot and show a silhouette instead.
          </li>
          <li><strong className="text-white">No profile pictures</strong> for now.</li>
          <li>
            <strong className="text-white">It's a beta.</strong> Features may change, and you may occasionally
            need to log in again after an update.
          </li>
          <li>
            Stats come straight from the NBA's own data, so any mistake in it will show up here too.
          </li>
        </Question>
      </section>

      <section className="mb-10">
        <SectionRule label="Your account" />

        <Question q="What do you store about me?">
          <li>Your username, email address and settings, plus the reviews, comments, lists and pyramids you create.</li>
          <li>Your password is stored securely (hashed), so nobody, including the developer, can read it.</li>
          <li>Your data isn't sold or used for ads.</li>
        </Question>
      </section>

      {/* ── Built with ────────────────────────────────────────── */}
      <section>
        <SectionRule label="Built with" />

        <Question q="Frontend">
          <li><strong className="text-white">React</strong> with <strong className="text-white">Vite</strong></li>
          <li><strong className="text-white">React Router</strong> for pages and navigation</li>
          <li><strong className="text-white">TanStack Query</strong> and <strong className="text-white">Axios</strong> for loading data</li>
          <li><strong className="text-white">Tailwind CSS</strong> and <strong className="text-white">Material UI</strong> for styling and icons</li>
          <li><strong className="text-white">Day.js</strong> for dates</li>
        </Question>

        <Question q="Backend">
          <li><strong className="text-white">Node.js</strong> and <strong className="text-white">Express</strong> for the API</li>
          <li><strong className="text-white">Prisma</strong> with a <strong className="text-white">PostgreSQL</strong> database</li>
          <li><strong className="text-white">JSON Web Tokens</strong> and <strong className="text-white">bcrypt</strong> for accounts and logins</li>
          <li><strong className="text-white">Python</strong> scripts for fetching and processing NBA data</li>
        </Question>

        <Question q="Data">
          <li><strong className="text-white">nba_api</strong> for games, box scores, shot charts and player stats</li>
          <li><strong className="text-white">YouTube Data API</strong> for finding game highlights</li>
        </Question>

        <Question q="Hosting">
          <li><strong className="text-white">Cloudflare Pages</strong> for the website and domain</li>
          <li><strong className="text-white">DigitalOcean</strong> for the API server</li>
          <li><strong className="text-white">Supabase</strong> for the database</li>
          <li><strong className="text-white">Docker</strong> and <strong className="text-white">Caddy</strong> for running the server with HTTPS</li>
          <li><strong className="text-white">GitHub</strong> for the code</li>
        </Question>
      </section>
    </div>
  )
}