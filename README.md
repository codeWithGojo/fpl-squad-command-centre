# FPL Squad Command Centre

A public-facing Fantasy Premier League decision dashboard built with Next.js and Tailwind CSS.

## Features

- Redesigned charcoal, white and blue workspace with responsive navigation and skeleton loading
- Six-week transfer planner with device-local save/restore and editable bank, selling prices and free transfers
- Roll-versus-transfer comparisons using full XI projections after hit costs
- Budget-constrained Wildcard and Free Hit drafts with squad/club constraints
- Safe, balanced and aggressive ranking preferences; 1%, 5% and 10% differential filters

Run `node tests/planner.cjs` for deterministic planner checks. Planning assumes current player prices remain fixed, no chips within a transfer sequence, and standard transfer rollover up to five. Seasonal exceptions are not inferred. Chip drafts are separate heuristic suggestions, not guaranteed optimal squads. Confirm chip availability, bank, current squad and selling values in official FPL. Public imports are published squads, not private current selections.

- Five-gameweek fixture difficulty heatmap
- Player transfer-value analysis with visible scoring logic
- Personal squad import from a public FPL team ID
- Expected-points projections, optimized XI, captain and vice-captain
- Sell and affordable replacement suggestions
- Price-rise/fall signals, low-ownership differentials, injury flags, and set-piece roles
- Wildcard, Free Hit, Bench Boost, and Triple Captain timing across the next ten gameweeks
- Season points/rank charts with best and worst gameweeks
- Rival squad comparison and classic mini-league standings
- Last-gameweek transfer what-if simulator and official Team of the Week
- Downloadable squad graphic generated privately in the browser
- Optional double-opt-in email and browser-push squad alerts
- Server-side proxy routes with shared caching and defensive API validation

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and connect a public FPL team ID.

## Production checks

```bash
npm run lint
npm run build
```

## Deployment

Import the project into Vercel as a Next.js application. The decision dashboard works without environment variables.

Alerts are optional and deliberately report “awaiting setup” until their services are configured. Copy `.env.example` and supply Upstash Redis REST, Resend, VAPID, app URL and cron-secret values. The included Vercel Cron checks opted-in squads daily at 21:00 UTC. Email subscriptions use a confirmation link and every message includes an unsubscribe link.

## Model boundaries

- Price-change signals are estimates because FPL does not publish its price algorithm.
- Expected points combine official expected points, form, season scoring rate, fixture difficulty, venue, minutes reliability and availability. The weight breakdown is shown in the UI.
- Chip windows are heuristic comparisons of projected captain/bench strength, doubles, blanks and squad availability—not guarantees.
- The what-if tool compares player-for-player official points; it does not reconstruct old selling prices, captaincy, bench order or transfer hits.

This is an unofficial tool and is not affiliated with the Premier League. Projections are estimates and every recommendation exposes its underlying signals so users can make the final decision.
