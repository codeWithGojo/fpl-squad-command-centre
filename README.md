# FPL Squad Command Centre

A public-facing Fantasy Premier League decision dashboard built with Next.js and Tailwind CSS.

## Features

- Five-gameweek fixture difficulty heatmap
- Player transfer-value analysis with visible scoring logic
- Personal squad import from a public FPL team ID
- Expected-points projections, optimized XI, captain and vice-captain
- Sell and affordable replacement suggestions
- Wildcard, Free Hit, Bench Boost, and Triple Captain advice
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

Import the project into Vercel as a Next.js application. No environment variables are required.

This is an unofficial tool and is not affiliated with the Premier League. Projections are estimates and every recommendation exposes its underlying signals so users can make the final decision.
