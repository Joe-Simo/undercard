# Undercard

**Book the undercard your city actually wants.**

Undercard is an agent for independent promoters, talent buyers, and small venues. Give it one headliner, one city, and your room size. It uses the Qloo taste graph to build a show brief:

- **Openers** who over-index with the headliner's audience in that city, filtered to the right popularity band for your capacity
- **Routing**: where this taste concentrates nearby (Qloo heatmap)
- **Partners**: local bars and restaurants this crowd loves, plus a brand sponsor shortlist
- **Ad plan**: podcasts and TV shows the audience over-indexes on, plus its demographic shape
- **Copy**: a tagline and social post that only reference entities Qloo returned
- **Audience overlap**: each opener scored against the headliner's audience, with the shared taste tags
- **Map**: a heatmap of where the headliner's audience lives, with suggested routing stops
- **Ask Undercard**: a follow-up agent that edits the brief in plain English ("swap opener 2", "go smaller", "what if Omaha?"), re-checking every change against Qloo
- **Gut vs Graph**: the same question answered by an LLM alone, side by side, to show what the taste data adds
- **Featured briefs** that open instantly, and a "How this brief was built" trace of every API call

Built for the Qloo Agentic Hackathon. Work in progress.

## How it uses Qloo

| Step | Qloo API |
| --- | --- |
| Resolve the headliner | `GET /search` (types `urn:entity:artist`) |
| Local opener candidates | `GET /v2/insights` with `filter.type=urn:entity:artist`, `signal.interests.entities`, `filter.location.query` |
| Tour routing | `GET /v2/insights` with `filter.type=urn:heatmap` |
| Pre-show partners | `GET /v2/insights` with `filter.type=urn:entity:place` + location |
| Sponsors, podcasts, TV | `GET /v2/insights` with `urn:entity:brand`, `urn:entity:podcast`, `urn:entity:tv_show` |
| Audience shape | `GET /v2/insights` with `filter.type=urn:demographics` |
| Opener overlap | `GET /v2/insights/compare` (headliner vs. opener) |
| "Go smaller" / "go bigger" | `GET /v2/insights` with `filter.popularity.max` / `filter.popularity.min` |

All calls go to `https://hackathon.api.qloo.com` with the `X-Api-Key` header. Responses are cached privately on the server and are never committed to this repository.

## Run it

```bash
pnpm install
cp .env.example .env.local   # add QLOO_API_KEY and one LLM key (GROQ_API_KEY recommended)
pnpm dev
```

Without keys the app runs in demo mode: Qloo responses are simulated with invented names (clearly labeled), and copy is templated. If the LLM provider fails mid-demo, Undercard falls back to templated copy instead of failing the brief.

## Stack

Next.js 16, React 19, Tailwind 4, shadcn/ui, MapLibre GL with CARTO basemaps, zod. The LLM layer is any OpenAI-compatible endpoint (Groq, GitHub Models, or Gemini).

## Limitations

Qloo results describe aggregate taste affinities. They are not predictions about any individual and are not a guarantee of ticket sales.

## License

MIT
