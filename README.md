# FPL Squad Command Centre

A public-facing Fantasy Premier League decision dashboard built with Next.js and Tailwind CSS.

## Features

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
