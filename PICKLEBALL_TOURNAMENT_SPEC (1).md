# Pickleball Tournament Live Leaderboard & Scorecard Platform
**Project Specification & Build Guide**

> Scope: Multi-day tournament, multiple courts running concurrently, scores entered by both referees (on phones, court-side) and admins (back office), with a fully open public-facing live leaderboard and scorecards. **Single-event build** — no multi-tournament history, no results export needed for this version.

**Locked-in decisions for this build:**
- Referees use **phones** (not tablets) — UI must work well on small screens.
- **Single-event only.** No need to support multiple tournaments or cross-event player history right now.
- **Public viewing is fully open** — no login, no tournament/division picker gating; viewers land straight on the live leaderboard.
- **No PDF/CSV export** in this version — results live on the site only.

---

## 1. Core Principles (Read This First)

Before any code, internalize these — they drive almost every decision below:

1. **Scores are entered at the edge (courts), consumed at the center (public leaderboard).** Design for write-heavy, low-latency input on courts and read-heavy, high-fanout broadcast to viewers.
2. **Two writers, one truth.** Referees and admins can both touch the same match. You need a single source of truth per match and a clear conflict-resolution rule — not "last write wins by accident."
3. **Courts will have bad WiFi.** A referee's phone losing signal mid-match is not an edge case, it's Tuesday. The scorecard UI must work offline-first and sync when reconnected.
4. **Public leaderboard must never show a half-written state.** A match that's "being edited" should not flicker incorrect scores to spectators. Use atomic updates + optimistic UI carefully.
5. **Audit everything.** When a score is disputed (and it will be), you need to know who entered what, when, and what it was before.

---

## 2. Tech Stack

| Layer | Recommendation | Why |
|---|---|---|
| Frontend (public + admin) | **Next.js (React) + TypeScript** | SSR for fast public leaderboard loads, file-based routing for `/tournament/[id]`, `/court/[id]` style URLs, good SEO if public-facing. |
| Styling | **Tailwind CSS** | Fast to build dense data UIs (tables, scorecards) consistently. |
| Real-time layer | **WebSockets via Socket.IO**, OR **Supabase/Firebase Realtime** if you want less infra to manage | Leaderboard and scorecards must push updates, not poll. Polling at scale across many viewers during a live match is wasteful and laggy. |
| Backend API | **Node.js + Express/Fastify (TypeScript)**, OR **Next.js API routes / Server Actions** if you want one repo | Keep score-write endpoints separate and simple; this is the most critical code path in the app. |
| Database | **PostgreSQL** (via Supabase, Neon, or self-hosted) | Tournament data is deeply relational (tournaments → brackets → matches → games → players → teams). Postgres handles this far better than a NoSQL store. |
| Offline support (referee app) | **PWA with IndexedDB queue** (e.g. via Dexie.js) | Referee taps a point, it's written locally first, then synced. Never block the UI on network. |
| Auth | **NextAuth.js / Clerk / Supabase Auth** | Need real roles (see Section 5) — don't roll your own auth from scratch. |
| Hosting | **Vercel** (frontend + API) + **Supabase/Neon** (DB + realtime) | Lowest ops overhead for a small team running a live event. |
| Mobile referee experience | **Responsive PWA, phone-first** (not a separate native app) | Referees are using phones, not tablets — design for ~360-430px width screens with large tap targets, not a scaled-down tablet layout. Installable on home screen so it feels app-like without app store overhead. |

**If you want to minimize what you build yourself:** Supabase gives you Postgres + Realtime (replaces Socket.IO) + Auth in one product, and is genuinely a strong fit here — most tournament apps at this scale don't need a hand-rolled WebSocket layer.

---

## 3. Data Model (Entities & Relationships)

This is the backbone. Get this right before writing UI.

**Single-event simplification:** since this is a single-event build, `Tournament` can be a single row (or even just config values) rather than a full multi-tenant entity. Players/teams don't need to persist across separate tournaments — just store what's needed for *this* event, scoped to it.

```
Tournament  (single row for this event — name, dates, ruleset)
 ├─ id, name, location, start_date, end_date, status (upcoming/live/completed)
 ├─ ruleset (best_of, points_to_win, win_by, scoring_type — see Section 6)
 └─ has many → Divisions

Division (e.g. "Men's Doubles 4.0", "Mixed Open")
 ├─ id, tournament_id, name, format (round_robin/single_elim/double_elim/pool_play)
 └─ has many → Teams, Matches

Team (a "team" is 1 player for singles, 2 for doubles)
 ├─ id, division_id, name/seed
 └─ has many → Players (1 or 2)

Player
 ├─ id, name, skill_level (optional), contact_info
 └─ belongs to → Teams (scoped to this event only — no cross-tournament history needed)

Match
 ├─ id, division_id, round, court_id, scheduled_time
 ├─ team_a_id, team_b_id
 ├─ status: scheduled | in_progress | paused | completed | disputed
 ├─ winner_id (nullable until completed)
 └─ has many → Games

Game (a single game within a match, since pickleball matches are often best-of-3)
 ├─ id, match_id, game_number
 ├─ team_a_score, team_b_score
 ├─ serving_team_id, server_number   (nullable — only used if scoring_type = 'traditional')
 ├─ status: in_progress | completed
 └─ has many → PointEvents (optional, for granular history/undo)

PointEvent  (OPTIONAL but strongly recommended — see Section 6)
 ├─ id, game_id, timestamp
 ├─ scoring_team_id, team_a_score_after, team_b_score_after
 ├─ entered_by_user_id, entered_by_role (referee/admin)
 └─ device_id (for offline conflict tracing)

Court
 ├─ id, tournament_id, name/number, status (active/idle/maintenance)
 └─ has many → Matches (scheduled over time)

User
 ├─ id, name, role (admin | referee | viewer)
 ├─ assigned_courts (for referees)
 └─ auth credentials

AuditLog
 ├─ id, entity_type, entity_id, action, old_value, new_value
 ├─ performed_by_user_id, timestamp
```

**Why `PointEvent` matters:** if you only store the current score on `Game`, you can't reconstruct "what happened," can't support undo safely, and can't resolve disputes ("ref says 8-6, admin overrode to 7-6 — what actually happened?"). Storing every point as an event makes the current score a *derived value*, not a fragile single field that two people stomp on.

**Why `serving_team_id` / `server_number` are on `Game`:** these only matter for traditional (side-out) scoring, and stay `null`/unused for rally scoring. See Section 6 for the flexible scoring design.

---

## 4. System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Referee PWA     │     │   Admin Panel    │     │  Public Viewer   │
│  (court-side)    │     │  (back office)   │     │  (leaderboard)    │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │ writes                 │ writes/overrides         │ read-only
         ▼                        ▼                          │
┌─────────────────────────────────────────────┐               │
│              API Layer (validated writes)     │               │
│   - Score update endpoint (idempotent)        │               │
│   - Conflict resolution logic                 │               │
│   - Role/permission checks                    │               │
└───────────────┬───────────────────────────────┘               │
                ▼                                               │
┌─────────────────────────────────────────────┐                 │
│            PostgreSQL (source of truth)       │                 │
└───────────────┬───────────────────────────────┘                 │
                ▼                                                 │
┌─────────────────────────────────────────────┐                   │
│     Realtime broadcast (Supabase Realtime /   │───────────────────┘
│     WebSocket pub/sub on score change)        │
└─────────────────────────────────────────────┘
```

Key flow: **referee/admin write → API validates → DB commit → realtime event fires → all connected leaderboard clients update.** Never have the public client poll the DB directly or have referees write directly to the DB from the client — always through the API so validation/conflict rules apply uniformly.

---

## 5. Roles & Permissions

| Role | Can do |
|---|---|
| **Admin** | Create/edit tournaments, divisions, brackets, schedules; assign referees to courts; **override any score**; resolve disputes; manage users; view audit log. |
| **Referee** | View only their assigned court(s)/match(es); enter points/scores for matches on their court; mark match complete; cannot edit other courts; cannot edit historical/completed matches without admin unlock. |
| **Viewer (public)** | Read-only: live leaderboard, bracket view, scorecards, match schedule. **Fully open — no login, no tournament/division selection screen.** Anyone landing on the site sees the live event immediately. |

**Conflict rule (important):** If both an admin and a referee try to update the same match score:
- Referee input is the "live" source during an active match.
- Admin input always **overrides** referee input and is logged as an override in `AuditLog`.
- Once admin overrides, that match should optionally lock from referee edits until admin releases it back — prevents a ping-pong of corrections live on the leaderboard.

---

## 6. Pickleball-Specific Rules to Encode

Don't hardcode these — make them configurable per division, since formats vary:

- **Scoring type:** Traditional (side-out, only serving team scores) vs. Rally scoring (every rally scores). This changes your point-increment logic — see flexible design below.
- **Points to win:** Usually 11, win by 2. Some finals are played to 15 or 21.
- **Match format:** Best of 1, best of 3 games.
- **Bracket format:** Round robin, single elimination, double elimination, pool play → bracket.
- **Tiebreakers:** Head-to-head, point differential, games won — needed for leaderboard sorting in round robin/pool play.
- **Forfeits/walkovers:** Need a status and a way to record them without a real score.
- **Time-based stoppages:** Pickleball doesn't have a clock typically, but some tournaments enforce match time limits — make this optional, not assumed.

### Keeping scoring type flexible (traditional vs. rally)

Build one scoring engine that branches, not two separate ones — rally scoring is really just a subset of what traditional scoring needs:

- `Division.scoring_type` is `'traditional' | 'rally'`, set per division.
- `Game.serving_team_id` / `Game.server_number` exist on every game but stay unused (`null`) for rally-scored divisions.
- A single `recordPoint()` function branches internally:

```ts
function recordPoint(game, scoringTeamId, scoringType) {
  if (scoringType === 'rally') {
    // anyone who wins the rally scores, simple increment
    incrementScore(game, scoringTeamId);
  } else {
    // traditional: only the serving team can score
    if (scoringTeamId === game.serving_team_id) {
      incrementScore(game, scoringTeamId);
    } else {
      sideOut(game); // flip serve, no point awarded
    }
  }
}
```

- The referee scorecard component takes `scoringType` as a prop: rally mode shows two simple tap targets; traditional mode adds a visible serve indicator (team + server 1/2) on top of the same two tap targets.
- **Default: `scoring_type = 'rally'` at the database level.** This isn't just a UI convention — set `default('rally')` on the column itself (see Prisma schema, Section 12). If an admin creates a division without explicitly choosing, it's rally scoring, not an unset/null state. This means the app never has to handle an "undecided" scoring type — every division always has a concrete, valid value the moment it's created.

---

## 7. Core Features (Build Order)

### Phase 1 — Foundation
- [ ] Tournament/division/court/team/player CRUD (admin only)
- [ ] User auth + roles
- [ ] Match scheduling (assign matches to courts/times)
- [ ] Basic match + game data model wired to DB

### Phase 2 — Live Scoring
- [ ] Referee scorecard UI (phone-sized, large tap targets for thumb use): current score prominent, undo last point, mark game/match complete
- [ ] Offline queue (IndexedDB) + sync-on-reconnect
- [ ] Admin override UI: view any match, edit score, lock/unlock from referee edits
- [ ] PointEvent logging on every score change
- [ ] AuditLog entries on every write

### Phase 3 — Real-Time Public Experience
- [ ] Public live leaderboard (standings per division, auto-sorted by tiebreaker rules) — open landing page, no gating
- [ ] Live scorecard view per match (real-time score, no refresh needed)
- [ ] Bracket visualization (for elimination formats)
- [ ] "Now playing" / court status board (what's live on each court right now)

### Phase 4 — Polish & Resilience
- [ ] Dispute flag + resolution flow (referee/player flags a score → admin reviews → resolves with audit trail)
- [ ] Match history view for completed matches (within this event — no cross-event archive needed)
- [ ] Notifications (optional): "your match is up next" via SMS/push

---

## 8. Real-Time Sync — Implementation Notes

1. **Single channel per tournament, sub-channels per court/division** — don't broadcast every point update to every viewer of every match; subscribe clients only to what they're viewing.
2. **Debounce leaderboard recalculation**, not point updates. Individual point updates can be instant; recalculating *standings* (which involves tiebreaker math across many matches) can be debounced by ~1-2 seconds during bursts.
3. **Optimistic UI on the referee side only.** The referee's own tap should feel instant locally (write to IndexedDB, render immediately), then confirm against server. The *public* leaderboard should only show server-confirmed state — never show a referee's unsynced local tap to the public.
4. **Reconnection logic:** on reconnect, referee app should diff its local queue against the server's current match state before blindly replaying, in case an admin already corrected something while it was offline.

---

## 9. Non-Functional Requirements

| Concern | Requirement |
|---|---|
| **Performance** | Leaderboard updates should reach viewers within ~1-2 seconds of a score being confirmed. |
| **Offline resilience** | Referee scorecard must remain usable with zero connectivity for at least one full match. |
| **Concurrency safety** | No two simultaneous writes should silently corrupt a score; last-write semantics must be explicit and logged, not accidental. |
| **Auditability** | Every score change must be traceable to a user, role, and timestamp. |
| **Mobile-first (phone-specific)** | Referee experience must work well on phones (not just tablets) in direct sunlight (high contrast UI) on a court — design for thumb reach and small screens from the start. |
| **Scalability** | Must handle many courts updating simultaneously without one court's update lagging another's. |
| **Data integrity on disputes** | Disputed matches must be resolvable without losing the original entries (soft corrections, not destructive edits). |

---

## 10. Suggested Repo Structure

```
/apps
  /web              → Next.js app (public site + admin + referee PWA, role-gated routes)
  /api              → Backend API (if separated from Next.js API routes)
/packages
  /db               → Prisma schema + migrations (Postgres)
  /shared-types     → Shared TS types (Match, Game, PointEvent, etc.) used by web + api
  /realtime         → WebSocket/Realtime client+server helpers
/docs
  PICKLEBALL_TOURNAMENT_SPEC.md   → this file
```

Use **Prisma** as the ORM against Postgres — it pairs well with TypeScript end-to-end and makes the relational model in Section 3 straightforward to manage and migrate.

---

## 11. Decisions Resolved for This Build

These were open questions in earlier drafts of this spec — now locked in:

| Question | Decision |
|---|---|
| Traditional or rally scoring? | Configurable per division (see Section 6) — **defaults to `rally` at the DB level** if an admin doesn't choose. |
| Referee device? | **Phones.** UI built phone-first, not scaled down from tablet. |
| Single-event or multi-tournament platform? | **Single-event.** No cross-tournament player history or multi-tenant tournament management needed. |
| Public viewing gated or open? | **Fully open.** No login, no picker screen — straight to the live leaderboard. |
| Results export (PDF/CSV)? | **Not needed** for this version. Results live on the site only. |

If any of these change later (e.g. you reuse this for a second event), the data model in Section 3 can be extended to support multiple tournaments without a rewrite — just revisit the "single-event simplification" note there.

---

## 12. Prisma Schema (Postgres)

This implements the data model from Section 3, the flexible scoring design from Section 6, and the single-event simplifications from the locked-in decisions. Drop this into `/packages/db/schema.prisma`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ──────────────────────────────────────────
// Enums
// ──────────────────────────────────────────

enum UserRole {
  ADMIN
  REFEREE
}
// Note: "viewer" is not a stored role — public viewing is fully open,
// unauthenticated, and needs no User row at all.

enum DivisionFormat {
  ROUND_ROBIN
  SINGLE_ELIM
  DOUBLE_ELIM
  POOL_PLAY
}

enum ScoringType {
  RALLY        // default — see Section 6
  TRADITIONAL
}

enum MatchStatus {
  SCHEDULED
  IN_PROGRESS
  PAUSED
  COMPLETED
  DISPUTED
}

enum GameStatus {
  IN_PROGRESS
  COMPLETED
}

enum CourtStatus {
  ACTIVE
  IDLE
  MAINTENANCE
}

enum EnteredByRole {
  REFEREE
  ADMIN
}

// ──────────────────────────────────────────
// Core event (single-event build — see Section 3)
// ──────────────────────────────────────────

model Tournament {
  id          String     @id @default(cuid())
  name        String
  location    String?
  startDate   DateTime
  endDate     DateTime
  status      String     @default("upcoming") // upcoming | live | completed
  pointsToWin Int        @default(11)
  winBy       Int        @default(2)
  bestOf      Int        @default(3) // 1 or 3 games per match, default ruleset

  divisions Division[]
  courts    Court[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Division {
  id           String         @id @default(cuid())
  tournamentId String
  tournament   Tournament     @relation(fields: [tournamentId], references: [id])
  name         String
  format       DivisionFormat

  // Flexible scoring — defaults to RALLY at the DB level (Section 6/11).
  // An admin creating a division without picking a value gets rally scoring,
  // never an unset/null state.
  scoringType  ScoringType    @default(RALLY)

  teams   Team[]
  matches Match[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Team {
  id         String   @id @default(cuid())
  divisionId String
  division   Division @relation(fields: [divisionId], references: [id])
  name       String?  // optional display name/seed, e.g. "Seed #3"

  players TeamPlayer[]

  matchesAsTeamA Match[] @relation("TeamA")
  matchesAsTeamB Match[] @relation("TeamB")
  matchesWon     Match[] @relation("Winner")

  gamesServingAs Game[] @relation("ServingTeam")
  pointEvents    PointEvent[]

  createdAt DateTime @default(now())
}

model Player {
  id          String @id @default(cuid())
  name        String
  skillLevel  String?
  contactInfo String?

  teams TeamPlayer[]

  createdAt DateTime @default(now())
}

// Join table: a Team has 1 player (singles) or 2 players (doubles).
// Scoped to this event only — no cross-tournament player history (Section 11).
model TeamPlayer {
  teamId   String
  team     Team   @relation(fields: [teamId], references: [id])
  playerId String
  player   Player @relation(fields: [playerId], references: [id])

  @@id([teamId, playerId])
}

model Court {
  id           String      @id @default(cuid())
  tournamentId String
  tournament   Tournament  @relation(fields: [tournamentId], references: [id])
  name         String      // e.g. "Court 3"
  status       CourtStatus @default(IDLE)

  matches Match[]

  createdAt DateTime @default(now())
}

model Match {
  id            String      @id @default(cuid())
  divisionId    String
  division      Division    @relation(fields: [divisionId], references: [id])
  round         String?     // e.g. "Pool A", "Quarterfinal"
  courtId       String?
  court         Court?      @relation(fields: [courtId], references: [id])
  scheduledTime DateTime?

  teamAId String
  teamA   Team   @relation("TeamA", fields: [teamAId], references: [id])
  teamBId String
  teamB   Team   @relation("TeamB", fields: [teamBId], references: [id])

  status   MatchStatus @default(SCHEDULED)
  winnerId String?
  winner   Team?       @relation("Winner", fields: [winnerId], references: [id])

  games Game[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Game {
  id          String     @id @default(cuid())
  matchId     String
  match       Match      @relation(fields: [matchId], references: [id])
  gameNumber  Int        // 1, 2, 3 within a best-of-3 match

  teamAScore Int @default(0)
  teamBScore Int @default(0)

  // Only populated/used when the division's scoringType is TRADITIONAL.
  // Stay null for RALLY-scored divisions (Section 6).
  servingTeamId String?
  servingTeam   Team?   @relation("ServingTeam", fields: [servingTeamId], references: [id])
  serverNumber  Int?    // 1 or 2, doubles server tracking

  status GameStatus @default(IN_PROGRESS)

  pointEvents PointEvent[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Every point as an event, not just a current score field (Section 3).
// Makes the live score a derived value and supports undo + dispute resolution.
model PointEvent {
  id      String @id @default(cuid())
  gameId  String
  game    Game   @relation(fields: [gameId], references: [id])

  scoringTeamId  String
  scoringTeam    Team   @relation(fields: [scoringTeamId], references: [id])
  teamAScoreAfter Int
  teamBScoreAfter Int

  enteredByUserId String
  enteredByUser   User          @relation(fields: [enteredByUserId], references: [id])
  enteredByRole   EnteredByRole

  deviceId String? // for offline conflict tracing on referee phones

  createdAt DateTime @default(now())
}

model User {
  id       String   @id @default(cuid())
  name     String
  role     UserRole
  email    String   @unique
  // password/auth fields depend on chosen auth provider (NextAuth/Clerk/Supabase Auth)
  // — omit raw password storage here; let the auth provider manage credentials.

  pointEvents PointEvent[]
  auditLogs   AuditLog[]

  createdAt DateTime @default(now())
}

model AuditLog {
  id         String   @id @default(cuid())
  entityType String   // "Match" | "Game" | "Division" | etc.
  entityId   String
  action     String   // "score_override" | "create" | "update" | "dispute_resolved" | etc.
  oldValue   Json?
  newValue   Json?

  performedById String
  performedBy   User   @relation(fields: [performedById], references: [id])

  createdAt DateTime @default(now())
}
```

### Notes on this schema

- **`ScoringType` defaults to `RALLY`** directly on the column (`@default(RALLY)`), matching the decision in Section 11 — no application-level fallback logic needed for an unset value.
- **No `Player`-level cross-tournament fields** — consistent with the single-event scope. If you ever extend this to multiple events, `Player` and `Team` are the models to revisit first (the schema note in Section 3 already flags this).
- **No export-related models or fields** — results live in `Match`/`Game`/`PointEvent` only, queried directly for the public leaderboard; nothing here assumes a PDF/CSV pipeline.
- **`AuditLog.oldValue` / `newValue` are `Json`** — flexible enough to log a score override, a division edit, or a dispute resolution without needing a different table per entity type.
- **Run `npx prisma migrate dev --name init`** once this is in place to generate the actual Postgres tables.
