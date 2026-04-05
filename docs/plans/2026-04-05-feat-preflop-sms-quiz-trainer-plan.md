---
title: Pre-Flop SMS Quiz Trainer
type: feat
status: completed
date: 2026-04-05
---

# Pre-Flop SMS Quiz Trainer

## Overview

A Bun + TypeScript app that sends daily SMS poker quiz messages to enrolled users. Users sign up via SMS keyword, set a send time and daily question count, then receive pre-flop range questions each day. They reply with short action codes; the app scores and responds with feedback. All quiz content is derived from hardcoded GTO range data. No web UI — SMS-only interface.

## Problem Statement / Motivation

Memorizing pre-flop GTO ranges is repetitive and best reinforced through spaced repetition. A daily SMS quiz removes friction: no app to open, no login, no subscription fatigue. The format mirrors real table decisions (given position + scenario + hand, pick an action).

## Proposed Solution

A single Bun process that:
1. Exposes a Twilio webhook endpoint for inbound SMS
2. Routes messages through a user state machine (onboarding → active → paused)
3. Runs an in-process `setInterval` scheduler to send daily question batches
4. Looks up GTO actions from static TypeScript range data to evaluate answers

---

## Technical Approach

### Stack

| Layer | Choice | Rationale |
|---|---|---|
| Runtime | Bun v1.2.3+ | Built-in SQLite, TypeScript, fast HTTP server |
| HTTP | `Bun.serve` (routes API) | Zero-dependency, handles form-encoded bodies natively |
| Database | `bun:sqlite` | Synchronous, file-based, no infra |
| SMS | Twilio REST + TwiML | Best two-way SMS; webhook + outbound API |
| Scheduling | `setInterval` (in-process) | Simpler than `Bun.cron()` for a single-process app |
| Range data | Static TypeScript `const` | Fully typed, tree-shaken, no parsing overhead |

### Directory Structure

```
src/
  index.ts                 -- entry point: start HTTP server + scheduler
  config.ts                -- env var loading with validation
  db/
    client.ts              -- Database singleton (bun:sqlite)
    schema.ts              -- CREATE TABLE IF NOT EXISTS migrations, run on startup
    users.ts               -- user CRUD helpers
    quiz-history.ts        -- quiz history CRUD helpers
  sms/
    webhook.ts             -- Bun.serve POST /sms handler
    validate.ts            -- Twilio X-Twilio-Signature verification
    format.ts              -- TwiML response builder
    dispatch.ts            -- Route inbound SMS based on user state
    onboarding.ts          -- Handle onboarding_time / onboarding_count states
  quiz/
    generate.ts            -- Pick random (position, scenario, hand) for a user
    evaluate.ts            -- Compare user reply to correct action
    message.ts             -- Format question SMS text + feedback SMS text
  scheduler/
    index.ts               -- setInterval loop (fires every 60s)
    send-batch.ts          -- For a given user, generate + send N questions via Twilio
  data/
    hands.ts               -- Canonical 169 hand strings (AA, AKs, AKo, ...)
    ranges/
      types.ts             -- Position, HandString, RfiAction, etc. utility types
      rfi.ts               -- RFI ranges: Record<Position, Record<HandString, RfiAction>>
      vs-rfi.ts            -- vs-RFI ranges: [heroPos][openerPos][hand] → VsRfiAction
      vs-3bet.ts           -- vs-3bet ranges: [heroPos][3bettorPos][hand] → Vs3betAction
      index.ts             -- Lookup helpers: getRfiAction, getVsRfiAction, getVs3betAction
```

### Database Schema

```sql
-- src/db/schema.ts
-- Note: run "PRAGMA foreign_keys = ON" at DB client startup

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  phone           TEXT    NOT NULL UNIQUE,
  status          TEXT    NOT NULL DEFAULT 'onboarding_time',
  -- "HH:MM" in APP_TIMEZONE (single-timezone app; known limitation for multi-region)
  send_time       TEXT,
  daily_count     INTEGER NOT NULL DEFAULT 5,
  -- Date of last sent batch ("YYYY-MM-DD"); dedup guard against double-send on restart
  last_sent_date  TEXT,
  created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for the per-minute scheduler query
CREATE INDEX IF NOT EXISTS idx_users_send_time
  ON users (send_time)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS quiz_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  position        TEXT    NOT NULL,   -- "BTN", "UTG", etc.
  scenario        TEXT    NOT NULL,   -- "rfi" | "vs_rfi" | "vs_3bet"
  -- nullable; only populated for vs_rfi and vs_3bet scenarios
  opener_position TEXT,
  hand            TEXT    NOT NULL,   -- "AKs", "72o", "AA"
  correct_action  TEXT    NOT NULL,   -- stored at send time; "open"|"fold"|"call"|"3bet"|"4bet"
  user_answer     TEXT,               -- nullable until answered or aged out
  is_correct      INTEGER,            -- nullable; 1 = correct, 0 = wrong, NULL = unanswered/aged out
  sent_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_quiz_history_user_unanswered
  ON quiz_history (user_id, sent_at)
  WHERE user_answer IS NULL;
```

### User State Machine

```
[new phone]
     |
   START keyword
     |
     v
onboarding_time  --(valid HH:MM reply)-->  onboarding_count
                                                   |
                                        (valid 1-20 reply)
                                                   |
                                                   v
                                                active  <--> paused
                                                   ^          |
                                                   |   STOP   |
                                                   +----------+
                                                   |   START  |
                                                   +----------+
```

State transition rules:
- Unknown number texting `START` → create user, set `status = onboarding_time`
- User mid-onboarding (`onboarding_time` or `onboarding_count`) texting `START` → reset to `onboarding_time` (restart onboarding)
- Active user texting `START` → reply with current settings ("You're already enrolled. Send time: 09:00, 5 questions/day. Text STOP to pause.")
- Paused user texting `START` → set `status = onboarding_time` (full re-onboarding; prior settings overwritten)
- Any user texting `STOP` → set `status = paused`
- Invalid reply during onboarding → re-prompt (do not advance state; trim + uppercase before validation)
- Blank or whitespace-only message during onboarding → re-prompt same question

**Twilio STOP / carrier compliance:**
Twilio intercepts opt-out keywords (STOP, UNSUBSCRIBE, CANCEL, END, QUIT) at the platform level, sends a compliant auto-reply, AND still forwards the webhook to our endpoint. So our STOP handler will fire — update `status = paused` in DB as normal.

However, if the scheduler tries to send to an opted-out number, Twilio returns error code `21610`. Handle this in `send-batch.ts` by catching the error, logging it, and setting `status = paused` for that user to keep the DB consistent.

### Daily Quiz Flow

```
setInterval (60s)
  → get current HH:MM in app timezone
  → SELECT users WHERE status = 'active' AND send_time = HH:MM
  → for each user:
      → generate N questions (no repeat of today's already-sent combos)
      → insert N rows into quiz_history (user_answer = NULL)
      → send N outbound SMS messages via Twilio REST
```

**Answer matching (webhook):**
```
Inbound SMS from known active user
  → find oldest unanswered quiz_history row for this user from today (FIFO order)
  → parse reply: trim, uppercase, take first character only
  → validate reply against scenario-specific valid codes:
      rfi scenario:      O → "open",  F → "fold"
      vs_rfi scenario:   C → "call",  3 → "3bet",  F → "fold"
      vs_3bet scenario:  C → "call",  4 → "4bet",  F → "fold"
  → if reply is not a valid code for that scenario:
      reply "Didn't understand. [scenario-specific valid codes reminder]"
      do not advance or mark the question
  → if no unanswered question found:
      reply "No quiz pending. Your next batch is at HH:MM."
  → if valid: update quiz_history (user_answer, is_correct, answered_at)
  → respond via TwiML with feedback
```

**Aging out:** At batch send time, mark all remaining unanswered rows from prior days (`sent_at < today midnight, user_answer IS NULL`) as aged out by setting `user_answer = 'AGED_OUT'`, `is_correct = 0`, `answered_at = now`. This keeps history clean and prevents stale questions surfacing.

**Feedback message format:**
```
Correct! AKs is an open from BTN.
```
```
Incorrect. KJo is a fold from UTG. Open range: QQ+, AKs, AKo.
```

### Range Data Types

```typescript
// src/data/ranges/types.ts

type Position = "UTG" | "UTG1" | "UTG2" | "LJ" | "HJ" | "CO" | "BTN" | "SB" | "BB";

type Scenario = "rfi" | "vs_rfi" | "vs_3bet";

type RfiAction = "open" | "fold";
type VsRfiAction = "fold" | "call" | "3bet";
type Vs3betAction = "fold" | "call" | "4bet";

type HandString = string; // one of the 169 canonical hand strings

type RfiData = Record<Position, Record<HandString, RfiAction>>;

// Sparse: not all hero/opener combos exist (can't face UTG open from UTG)
type VsRfiData = Partial<Record<Position, Partial<Record<Position, Record<HandString, VsRfiAction>>>>>;

type Vs3betData = Partial<Record<Position, Partial<Record<Position, Record<HandString, Vs3betAction>>>>>;
```

### Quiz Message Formats

**Question SMS:**
```
BTN | FTR | A♥K♠
Open or fold? Reply: O / F
```
```
CO | vs UTG open | 8♠7♠
Reply: C (call) / 3 (3-bet) / F (fold)
```
```
BTN | you opened, BB 3-bet | K♥Q♠
Reply: C (call) / 4 (4-bet) / F (fold)
```

**Sign-up flow SMS:**
```
Welcome to PokerTrainer! What time should I send your daily quizzes?
Reply with HH:MM (24h), e.g. 09:00 or 20:30
```
```
How many questions per day? Reply with a number from 1 to 20.
```
```
You're enrolled! I'll send 5 questions at 09:00 each day.
Text STOP to unenroll, START to re-configure.
```

### Twilio Webhook Handler Sketch

```typescript
// src/sms/webhook.ts
import * as Bun from "bun";
import * as twilio from "twilio";

Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  routes: {
    "/sms": {
      POST: async (req) => {
        const isValid = await validateSignature({ req });
        if (!isValid) {
          return new Response("Forbidden", { status: 403 });
        }
        const body = await req.formData();
        const from = body.get("From") as string;
        const text = (body.get("Body") as string).trim();
        const twiml = await handleInbound({ from, text });
        return new Response(twiml, {
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
  fetch: () => new Response("Not Found", { status: 404 }),
});
```

### Scheduler Sketch

```typescript
// src/scheduler/index.ts
const TICK_MS = 60_000;

const tick = async () => {
  const today = getTodayDateString(); // "YYYY-MM-DD" in app timezone
  const now = getCurrentHHMM();       // "HH:MM" in app timezone
  // last_sent_date guard: never send twice in the same calendar day
  const dueUsers = getUsersDueAt({ sendTime: now, excludeLastSentDate: today });
  for (const user of dueUsers) {
    await sendBatch({ user, today });
  }
};

setInterval(tick, TICK_MS);
tick(); // fire immediately on startup to catch missed sends
```

**Double-send prevention:** `getUsersDueAt` filters `WHERE send_time = ? AND (last_sent_date IS NULL OR last_sent_date != ?)`. The `sendBatch` function updates `last_sent_date = today` before sending any messages, so a process restart during a batch does not re-send.

---

## System-Wide Impact

### Interaction Graph

```
Inbound SMS → Twilio → POST /sms webhook
  → validateSignature
  → dispatch (check user.status)
    → if onboarding: reply with next prompt, update status
    → if active + unanswered question: evaluate reply, update quiz_history, reply with feedback
    → if active + no pending question: "No quiz pending. Your next batch is at HH:MM."
    → if paused: "You're unsubscribed. Text START to re-enroll."
    → if unknown: "Text START to sign up."
  → TwiML response → Twilio → user's phone

setInterval tick
  → getUsersDueAt
  → generateQuestions (reads range data, checks today's quiz_history for deduplication)
  → insertQuizHistory (N rows)
  → sendOutboundSms × N (Twilio REST API)
```

### Error & Failure Propagation

| Failure | Impact | Handling |
|---|---|---|
| Twilio outbound send fails | User misses quiz batch | Log error, continue with next user; no retry |
| DB write fails on quiz_history insert | Questions sent but not trackable | Log error; Twilio has delivered — answer will land in "no pending question" path |
| Invalid Twilio signature | Possible spoofed request | Return 403, log |
| Scheduler tick overlaps (slow Twilio API) | Could re-send to same user | Guard: check `sent_at >= today midnight` before sending batch |
| User replies with unrecognized text | No action code matched | Reply "Didn't understand. Reply O, F, C, 3, or 4." |

### State Lifecycle Risks

- **Double-send**: If startup fires `tick()` immediately and a `setInterval` fires within 60s at the same HH:MM, a user could receive two batches. Guard with a `last_sent_date` column on `users`, or check `quiz_history` sent_at before sending.
- **Orphaned onboarding users**: A user texts START but never completes onboarding. No cleanup mechanism — acceptable for v1 (small user base).
- **Clock drift**: `setInterval` drift over hours could cause misses at exact HH:MM. Mitigation: compare `>=` send_time rather than exact match, plus `last_sent_date` deduplication.

### Integration Test Scenarios

1. **Full sign-up flow**: Simulate START → time reply → count reply → verify user row in DB with status=active
2. **Correct answer**: Insert quiz_history row, simulate answer reply, verify is_correct=1 and TwiML feedback
3. **Wrong answer**: Same but wrong reply letter, verify is_correct=0 and feedback includes correct action
4. **Scheduler send**: Manually set user send_time to current HH:MM, tick scheduler, verify N quiz_history rows inserted and N Twilio calls made
5. **Double-send guard**: Tick scheduler twice with same HH:MM, verify only one batch sent

---

## Acceptance Criteria

### Functional

- [ ] Texting START to the Twilio number creates a new user and starts the onboarding flow
- [ ] Onboarding collects send_time (validated HH:MM) and daily_count (validated 1–20) over SMS
- [ ] Invalid onboarding replies re-prompt without advancing state
- [ ] Enrolled users receive N quiz SMS messages at their scheduled time daily
- [ ] Quiz questions cover all three scenarios (FTR, vs FTR, FTR vs 3-bet) across all 9 positions
- [ ] Replying with O / F / C / 3 / 4 (case-insensitive) scores the answer and sends feedback
- [ ] Unrecognized replies return a "didn't understand" message
- [ ] No unanswered question: reply informs user of next batch time
- [ ] STOP pauses the user; START re-initiates onboarding
- [ ] Scheduler does not double-send if process restarts during the send window
- [ ] Twilio signature validation rejects spoofed requests with 403

### Non-Functional

- [ ] `bun:sqlite` used directly (no ORM, no migrations library)
- [ ] All CLAUDE.md conventions followed (namespace imports, closure functions, no `any`, `type` keyword, named args for 3+ params, JSDoc, explicit null checks)
- [ ] Twilio auth token and phone number stored in `.env`, never hardcoded
- [ ] Single timezone configured in `APP_TIMEZONE` env var (e.g., `America/New_York`)

### Quality Gates

- [ ] `bun test` suite covers: sign-up flow, answer evaluation, question generation, scheduler dedup guard
- [ ] Range data covers all 9 positions × FTR scenario at minimum for v1

---

## Dependencies & Prerequisites

- Bun v1.2.3+ (for `routes` API in `Bun.serve`)
- Twilio account with a purchased phone number
- `twilio` npm package (`bun add twilio`)
- `ngrok` or equivalent for local webhook development
- GTO range data manually encoded from GTO Wizard free charts (18 charts: 9 positions × FTR for v1; expand later)

---

## Implementation Phases

### Phase 1: Bootstrap + DB (start here)

- `bun init`, `bun add twilio`
- `tsconfig.json` (Bun-compatible: `"module": "Preserve"`, `"target": "ESNext"`)
- `.env.example` with all required vars
- `src/config.ts` — load + validate env vars at startup (fail fast if missing)
- `src/db/client.ts` — Database singleton, WAL mode enabled
- `src/db/schema.ts` — run migrations on startup
- `src/db/users.ts` + `src/db/quiz-history.ts` — typed CRUD helpers

**Files:**
- `package.json`
- `tsconfig.json`
- `.env.example`
- `src/config.ts`
- `src/db/client.ts`
- `src/db/schema.ts`
- `src/db/users.ts`
- `src/db/quiz-history.ts`

### Phase 2: Range Data

- `src/data/hands.ts` — all 169 canonical hand strings (pairs, suited, offsuit), plus suit-specific display strings (A♥K♠ style) for question rendering
- `src/data/ranges/types.ts` — all utility types
- `src/data/ranges/rfi.ts` — hand-code RFI ranges for all 9 positions from GTO Wizard free charts
- `src/data/ranges/vs-rfi.ts` — start with BTN/CO/SB/BB facing UTG/MP/CO opens (most common quiz spots)
- `src/data/ranges/vs-3bet.ts` — start with BTN/CO facing BB/BTN 3-bets
- `src/data/ranges/index.ts` — `getRfiAction`, `getVsRfiAction`, `getVs3betAction` lookup helpers

**Note:** Range data entry is manual (transcribe from GTO Wizard). Budget ~15 min per chart. Start with FTR only for v1 launch; add vs-RFI and vs-3bet in follow-up.

### Phase 3: Quiz Core

- `src/data/hands.ts` — display hand picker (randomly assign suits for display)
- `src/quiz/generate.ts` — `generateQuestion(args: { userId: number, db: Database })` — picks random scenario/position/hand, skips combos already sent today
- `src/quiz/evaluate.ts` — `evaluateAnswer(args: { reply: string, correctAction: string })` — parses and compares
- `src/quiz/message.ts` — `formatQuestion(...)` and `formatFeedback(...)` — builds SMS text strings

**Files:**
- `src/quiz/generate.ts`
- `src/quiz/evaluate.ts`
- `src/quiz/message.ts`

### Phase 4: Webhook + SMS Handling

- `src/sms/validate.ts` — `validateSignature(args: { req: Request, authToken: string, webhookUrl: string })` — wraps `twilio.validateRequest`
- `src/sms/format.ts` — `buildTwiml(message: string): string` — wraps `twilio.twiml.MessagingResponse`
- `src/sms/onboarding.ts` — `handleOnboarding(args: { user, text, db })` — processes onboarding states, validates input, updates status
- `src/sms/dispatch.ts` — `handleInbound(args: { from, text, db })` — master router: look up user, branch on status
- `src/sms/webhook.ts` — `Bun.serve` entry with `/sms` POST route

**Files:**
- `src/sms/validate.ts`
- `src/sms/format.ts`
- `src/sms/onboarding.ts`
- `src/sms/dispatch.ts`
- `src/sms/webhook.ts`

### Phase 5: Scheduler

- `src/scheduler/send-batch.ts` — `sendBatch(args: { user, db, twilioClient })` — generates N questions, inserts history rows, sends outbound SMS
- `src/scheduler/index.ts` — `startScheduler(args: { db, twilioClient })` — `setInterval` + immediate tick

**Files:**
- `src/scheduler/send-batch.ts`
- `src/scheduler/index.ts`

### Phase 6: Entry Point + Tests

- `src/index.ts` — import db, run schema, start scheduler, start HTTP server
- `src/db/schema.test.ts` — schema migration is idempotent
- `src/sms/dispatch.test.ts` — sign-up flow state transitions
- `src/quiz/evaluate.test.ts` — answer evaluation + edge cases
- `src/scheduler/send-batch.test.ts` — dedup guard, question count

**Files:**
- `src/index.ts`
- `src/*.test.ts`

---

## Risk Analysis & Mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Twilio trial account limits | High for dev | Use trial credits; document upgrade path |
| Scheduler double-send on restart | Medium | `last_sent_date` column on users or quiz_history check |
| Range data inaccuracies | Medium | Start with widely-published simplified ranges; note source in comments |
| `setInterval` drift causing missed sends | Low | Match on `>=` send_time within same minute; `last_sent_date` dedup |
| Twilio webhook signature fails behind proxy | Medium | Document `WEBHOOK_URL` must match Twilio console URL exactly; use `X-Forwarded-*` headers if needed |

---

## Future Considerations

- **vs-RFI and vs-3bet scenarios**: Phase 2 range data expansion
- **Score tracking**: Add `correct_count / total_count` to `users` table; send weekly summary SMS
- **Multiple timezones**: Replace `APP_TIMEZONE` with per-user `timezone` column on `users`, collected during onboarding
- **HELP command**: Reply to "HELP" or "?" with current settings + available commands
- **Settings update command**: Allow "TIME 20:00" or "COUNT 10" to update without full re-enrollment
- **Web sign-up**: Optional QR code landing page for easier enrollment
- **Weighted question selection**: Surface hands the user gets wrong more often
- **Carrier spam throttling**: For users with `daily_count > 10`, add a short delay between outbound sends to avoid triggering carrier spam filters

---

## Environment Variables

```bash
# .env.example
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15555550000
WEBHOOK_URL=https://your-tunnel.ngrok.io/sms
APP_TIMEZONE=America/New_York
PORT=3000
DB_PATH=./quiz.sqlite
```

---

## References & Research

### Internal

- Brainstorm: `docs/brainstorms/2026-04-05-preflop-sms-quiz-brainstorm.md`

### External

- Bun HTTP server (`Bun.serve` routes API): requires Bun v1.2.3+; Twilio sends `application/x-www-form-urlencoded` — use `req.formData()`, not `req.json()`
- `bun:sqlite`: synchronous API — do not `await` query calls; use `db.query()` for cached prepared statements
- Twilio signature validation: `twilio.validateRequest(authToken, signature, webhookUrl, params)` — `webhookUrl` must exactly match the URL in Twilio console
- TwiML synchronous reply: return XML with `Content-Type: text/xml`; `twilio.default(sid, token)` for the REST client (default export accessed via namespace import)
- `Bun.cron()` runs a file, not a callback — use `setInterval` for in-process scheduling
- GTO range data: no freely licensed machine-readable dataset exists; manually transcribe from GTO Wizard free charts (~15 min/chart)
