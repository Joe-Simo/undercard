# Undercard

**Who opens this show, in this room, in this city.**

Talent buyers at independent venues pick support acts every week, mostly from memory, agent pitches, and streaming numbers that say nothing about their own market or their room. Undercard answers that one booking question with Qloo taste data: give it a headliner, a city, and your capacity, and it ranks the openers this headliner's audience already loves in your market, sized for your room, with the evidence behind every pick.

Live demo: https://undercard-phi.vercel.app (no login). It runs on live Qloo data from the hackathon server.

![The bill, ranked](docs/screenshots/2-the-bill.png)

## What it does

- **The bill, ranked.** Five openers, each with local affinity, shared taste with the headliner, Qloo popularity, and a size band for your room (right-size, stretch, too big, too small). Small rooms ask Qloo for acts under the room's popularity ceiling, so a 350-cap club is not handed acts that sell out theaters. The next acts considered are listed underneath, so you can see why they missed.
- **Which one?** When a name has no exact match in Qloo (a typo or a partial name), Undercard shows the closest artists and asks before it builds.
- **Ask Undercard.** Change the bill in plain English ("swap opener 2", "go smaller", "what if Omaha?"). Every change is re-checked against Qloo.
- **Gut vs Graph.** The same question asked of the model with no Qloo data, side by side.
- **Supporting notes.** Audience shape, where else this taste lives (Qloo heatmap), pre-show partners, sponsors, and ad buys. Useful context, deliberately secondary.
- **Share, print, and agents.** Copy a link, save a print-ready PDF, or call the same tools from any agent over MCP at `/api/mcp`.

| | |
| --- | --- |
| ![Home](docs/screenshots/1-home.png) | ![Gut vs Graph](docs/screenshots/3-gut-vs-graph.png) |
| ![Supporting notes](docs/screenshots/4-supporting-notes.png) | ![Every Qloo call shown](docs/screenshots/5-qloo-trace.png) |

## How it works

![Architecture](docs/architecture.png)

## Qloo calls

Every call uses only parameters documented in Qloo's reference ([docs-public](https://github.com/qloo/docs-public/tree/main/reference)), goes to `https://hackathon.api.qloo.com` with the `X-Api-Key` header, and is listed in the in-app trace. Qloo ignores unknown parameters silently, so `pnpm live-check` verifies each one live with non-empty results and checks that the location and popularity filters actually change the answer. On Oct 19, 2026 it passed 18 of 18 checks against the hackathon server.

| Step | Call |
| --- | --- |
| Resolve the headliner, ask "Which one?" if ambiguous | `GET /search` with `query`, `types=urn:entity:artist`, `take` |
| Artists this audience loves in the city | `GET /v2/insights` with `filter.type=urn:entity:artist`, `signal.interests.entities`, `signal.location.query`, `take` |
| Acts that fit the room | the same call plus `filter.popularity.max` set to the room's ceiling (rooms under 3,000) |
| Go smaller or bigger | the same call plus `filter.popularity.max` or `filter.popularity.min` |
| Shared taste, headliner vs. each opener | `GET /v2/analysis/compare` with `a.signal.interests.entities`, `b.signal.interests.entities` |
| Audience shape | `GET /v2/insights` with `filter.type=urn:demographics`, `signal.interests.entities` |
| Where this taste lives | `GET /v2/insights` with `filter.type=urn:heatmap`, `signal.interests.entities`, `filter.location.query`, `filter.location.radius` |
| Pre-show partners | `GET /v2/insights` with `filter.type=urn:entity:place`, `signal.interests.entities`, `filter.location.query` |
| Sponsors, podcasts, TV | `GET /v2/insights` with `filter.type` brand, podcast, or tv_show, `signal.interests.entities`, `signal.location.query` |

Location parameters follow the docs: `filter.location.*` is documented for places, destinations, and heatmaps; other entity types are localized with `signal.location.query`. Qloo matches the city by name, and two-letter state codes are read loosely (on the hackathon server "Lawrence, KS" matched a Toronto neighborhood and "Richmond, VA" matched Staten Island), so Undercard spells the state out before sending and shows the locality Qloo matched in the trace.

Qloo data never enters this repository. Responses are cached privately on the server. Featured briefs are built ahead of time into `data/featured/` (gitignored) and shipped only inside the deployment; a test fails if any Qloo-derived file is ever tracked. Every other brief, and every edit to it, is saved to a private Vercel Blob store (when `BLOB_READ_WRITE_TOKEN` is set), so a shared link opens on any server instance. Editing a featured brief forks a new brief, so the featured ones stay as shipped.

## Gut vs Graph benchmark

`pnpm benchmark` runs twelve fixed cases (real headliners, cities, and room sizes in `src/lib/benchmark/cases.ts`, chosen before any run) through the real pipeline. Each case asks the model alone, with no Qloo data, for five openers ("Gut"), and scores that list and Undercard's bill ("Graph") with one rule, stated in `src/lib/benchmark/score.ts`:

> A pick counts when it appears in Qloo's top 50 artists for this headliner's audience in this city, under the room's popularity ceiling, and its popularity is right-size or a stretch for the room. Score = counted picks out of 5.

Live run, Oct 19, 2026 (Qloo hackathon server, OpenRouter `nvidia/nemotron-3-ultra-550b-a55b:free`, every Gut list written by the model):

| | Score | Picks that count |
| --- | --- | --- |
| Gut (model alone) | 0.17 | 10 of 60 |
| Graph (Undercard) | 1.00 | 60 of 60, by construction |

Graph scoring 1.00 is not the finding: the ruler is Qloo's own data, which Undercard also uses to choose. The finding is the Gut column. For the eight rooms of 1,000 capacity or less, none of the model's 40 picks appear in Qloo's room-sized list for that city; it tends to name the headliner's best-known peers. For the four rooms of 1,500 to 3,000, 10 of its 20 picks count. This measures fit to local taste and room size as Qloo sees them, not ticket sales.

The rule changed once, and the first result is kept. Rule v1 (written Oct 18, before the key) used the top 50 local artists with no popularity cap. Its first live run scored Graph 0.35 and Gut 0.10, and showed why: that list is almost all popularity 0.8 and up, so small rooms got only "too big" acts, from Undercard as well. That run is what led to the room ceiling above, and to spelling out state names.

## Daily allowance

The demo runs on free model quotas, so each visitor gets 3 fresh briefs and 8 edits a day, with a shared budget of 40 model calls a day per server instance. When a limit is reached, Undercard says so calmly and points to the featured briefs, which load with no model calls. If the provider's quota still runs out, briefs fall back to templated copy instead of failing. Limits are configurable in `.env.example`.

## Use it from any agent (MCP)

Undercard is an MCP server (Streamable HTTP, stateless) at `/api/mcp`, with the same pipeline, Qloo calls, and allowance as the web app.

| Tool | What it does |
| --- | --- |
| `build_show_brief` | Headliner, city, and capacity in; a ranked bill and supporting notes out. Ambiguous names return `needs_choice`; call again with `headliner_id`. |
| `get_show_brief` | Read a saved or featured brief by id. |
| `ask_undercard` | Edit or question a brief in plain English. City or capacity changes, and edits to a featured brief, return a new brief id. |
| `list_featured_briefs` | Example briefs that are always available. |

```json
{ "mcpServers": { "undercard": { "url": "https://undercard-phi.vercel.app/api/mcp" } } }
```

## Run it

```bash
pnpm install
cp .env.example .env.local   # add QLOO_API_KEY and one LLM key (OPENROUTER_API_KEY recommended)
pnpm dev
```

Without keys the app runs in demo mode for development: Qloo responses are simulated with invented names (clearly labeled on screen), and copy is templated. The live demo runs on real Qloo data.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

The tests run the full pipeline, the "Which one?" step, the API routes, the MCP tools, the daily allowance, brief storage, the live-check harness, and the benchmark scoring rule in demo mode, with no keys and no network.

With a Qloo key in `.env.local`, `pnpm live-check` calls every Qloo endpoint above once, checks the exact fields the client reads (descriptions, affinity, popularity, heatmap cells, the compare shape, and whether location and popularity filters take effect), prints PASS, WARN, or FAIL for each, and then runs the benchmark. `--skip-benchmark` spends no LLM quota.

## Stack

Next.js 16, React 19, Tailwind 4, shadcn/ui, MapLibre GL with CARTO basemaps, zod. The LLM layer is any OpenAI-compatible endpoint: OpenRouter free models by default (NVIDIA Nemotron 3 Ultra, with Gemma 4 and Nemotron 3 Super as fallbacks), or Groq, GitHub Models, or Gemini. Responses are cached by prompt hash, retried with backoff, and fall back to templates.

## What Undercard does not claim

- Qloo results describe aggregate taste affinities. They are not predictions about any individual and not a guarantee of ticket sales.
- The size bands are a simple mapping from capacity to Qloo popularity percentile, written by us, not an industry standard.
- Availability, fees, routing dates, and radius clauses are outside what Undercard knows. A buyer still makes the call.
- "Shared taste" is the mean score of the top 10 tags Qloo's compare endpoint says two artists share. It is a taste signal, not a count of shared fans.
- The benchmark's ruler is Qloo's own data, so Undercard's 1.00 is by construction; only the model-only score is informative.

## License

MIT
