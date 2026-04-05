---
date: 2026-04-05
topic: preflop-sms-quiz
---

# Pre-Flop Range SMS Quiz Trainer

## What We're Building

A Bun TypeScript application that helps poker players memorize pre-flop Texas Hold'em starting ranges via SMS. Users sign up by texting a keyword, set their preferred daily time and question count, and receive daily quiz messages. Each quiz asks the user to choose an action for a given hand + position + scenario. They reply with a short answer, and the app confirms whether they were correct.

The three scenarios covered are:
- **FTR (First To Raise)** — you're the first to act preflop; open, fold, or limp?
- **vs FTR** — someone has opened; call, 3-bet, or fold?
- **FTR vs 3-bet** — you opened and face a 3-bet; call, fold, or 4-bet?

All 9 positions are covered: UTG, UTG+1, UTG+2, LJ, HJ, CO, BTN, SB, BB.

## Why This Approach

**Quiz format — show hand, ask action:** The most natural poker decision framing. Mimics real table decisions and maps cleanly to short SMS replies (O/F/L or C/3/F etc.). Yes/no threshold questions were simpler but less realistic. Multiple choice was redundant given the action set is already small and known.

**Twilio:** Best two-way SMS support with a straightforward webhook model. Incoming replies trigger a webhook; the app responds synchronously. Free trial is enough to prototype.

**SQLite via Bun:** Zero-dependency, file-based, multi-user capable. Right-sized for a personal/small-group app. No infra to manage.

**SMS keyword sign-up:** Lowest friction — no web form, no account. User texts START, answers two setup questions (time + daily count) over SMS, and is enrolled. Unenroll with STOP.

**Fixed daily schedule:** Simple mental model for the user. A cron process fires at each scheduled time and sends the day's batch to all users whose time matches.

## Key Decisions

- **Tech stack**: Bun + TypeScript, no framework needed beyond a lightweight HTTP server for the Twilio webhook
- **SMS**: Twilio — inbound via webhook, outbound via REST API
- **Storage**: SQLite (Bun built-in) — tables for `users`, `quiz_queue`, `quiz_history`
- **Scheduler**: Bun's built-in cron or a simple `setInterval` loop that checks every minute for users whose send time has arrived
- **Sign-up flow**: Conversational SMS — START → ask time → ask daily count → enrolled
- **Quiz message format**:
  ```
  UTG | FTR | Hand: A♥K♠
  Action? Reply: O (open) / F (fold)
  ```
  ```
  CO | vs UTG open | Hand: 8♠7♠
  Reply: C (call) / 3 (3-bet) / F (fold)
  ```
  ```
  BTN | you opened, BB 3-bet | Hand: K♥Q♠
  Reply: C (call) / 4 (4-bet) / F (fold)
  ```
- **User state machine**: users have a `status` (onboarding_time | onboarding_count | active | paused) to handle the multi-step SMS enrollment
- **Questions per day**: user-configurable, set during sign-up (suggested range: 1–20)

## Resolved Questions

- **Range data source**: Hardcoded GTO ranges encoded in the app — no user setup needed.
- **Feedback depth**: Simple correct/incorrect. "Incorrect. KQo is a fold UTG." — concise, SMS-friendly.
- **Unanswered questions**: Skip them. Unanswered messages age out; the next day's batch is fresh.
- **Timezone handling**: Single timezone assumed (personal/small-group app). Hardcode the app timezone in config.

## Next Steps

→ `/workflows:plan` for implementation details
