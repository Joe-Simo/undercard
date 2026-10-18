# Undercard

**Book the undercard your city actually wants.**

Undercard is an agent for independent promoters, talent buyers, and small venues. Give it one headliner, one city, and your room size. It uses the Qloo taste graph to build a show brief:

- **Openers** who over-index with the headliner's audience in that city, filtered to the right popularity band for your capacity
- **Routing**: where this taste concentrates nearby (Qloo heatmap)
- **Partners**: local bars and restaurants this crowd loves, plus a brand sponsor shortlist
- **Ad plan**: podcasts and TV shows the audience over-indexes on, plus its demographic shape
- **Copy**: a tagline and social post that only reference entities Qloo returned
- **Gut vs Graph**: the same question answered by an LLM alone, side by side, to show what the taste data adds

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

All calls go to `https://hackathon.api.qloo.com` with the `X-Api-Key` header. Responses are cached privately on the server and are never committed to this repository.

## Run it

```bash
pnpm install
cp .env.example .env.local   # add QLOO_API_KEY and NEBIUS_API_KEY
pnpm dev
```

Without keys the app runs in demo mode: Qloo responses are simulated with invented names (clearly labeled), and copy is templated.

## Limitations

Qloo results describe aggregate taste affinities. They are not predictions about any individual and are not a guarantee of ticket sales.

## License

MIT
