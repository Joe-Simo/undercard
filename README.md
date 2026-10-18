# Undercard

**Book the undercard your city actually wants.**

Undercard is an agent for independent promoters, talent buyers, and small venues. Give it one headliner, one city, and your room size. It uses the Qloo taste graph to build a show brief:

- **Which one?**: when a name matches more than one artist in Qloo (two bands called Nirvana), Undercard asks before it builds, with a one-line description of each
- **Openers** who over-index with the headliner's audience in that city, filtered to the right popularity band for your capacity
- **Routing**: where this taste concentrates nearby (Qloo heatmap)
- **Partners**: local bars and restaurants this crowd loves, plus a brand sponsor shortlist
- **Ad plan**: podcasts and TV shows the audience over-indexes on, plus its demographic shape
- **Copy**: a tagline and social post that only reference entities Qloo returned
- **Audience overlap**: each opener scored against the headliner's audience, with the shared taste tags
- **Map**: a heatmap of where the headliner's audience lives, with suggested routing stops
- **Ask Undercard**: a follow-up agent that edits the brief in plain English ("swap opener 2", "go smaller", "what if Omaha?"), re-checking every change against Qloo
- **Gut vs Graph**: the same question answered by an LLM alone, side by side, to show what the taste data adds
- **Share and export**: copy a link to any brief, or save it as a clean, print-ready PDF from the browser
- **MCP server** at `/api/mcp`, so any agent (Claude, Cursor, ChatGPT, your own) can build, read, and edit briefs with the same tools
- **Featured briefs** precomputed ahead of time, so they load without live API calls, and a "How this brief was built" trace of every API call

Built for the Qloo Agentic Hackathon. Work in progress.

## How it uses Qloo

| Step | Qloo API |
| --- | --- |
| Resolve the headliner, and ask "Which one?" when the name is ambiguous | `GET /search` (types `urn:entity:artist`) |
| Local opener candidates | `GET /v2/insights` with `filter.type=urn:entity:artist`, `signal.interests.entities`, `filter.location.query` |
| Tour routing | `GET /v2/insights` with `filter.type=urn:heatmap` |
| Pre-show partners | `GET /v2/insights` with `filter.type=urn:entity:place` + location |
| Sponsors, podcasts, TV | `GET /v2/insights` with `urn:entity:brand`, `urn:entity:podcast`, `urn:entity:tv_show` |
| Audience shape | `GET /v2/insights` with `filter.type=urn:demographics` |
| Opener overlap | `GET /v2/insights/compare` (headliner vs. opener) |
| "Go smaller" / "go bigger" | `GET /v2/insights` with `filter.popularity.max` / `filter.popularity.min` |

All calls go to `https://hackathon.api.qloo.com` with the `X-Api-Key` header. Responses are cached privately on the server and are never committed to this repository. Live Qloo calls are wired up but not yet exercised: until a hackathon key is issued, every Qloo response in this app is simulated.

## Use it from any agent (MCP)

Undercard is also an MCP server (Streamable HTTP, stateless) at `/api/mcp`. It runs the same pipeline, Qloo calls, and rate limits as the web app.

| Tool | What it does |
| --- | --- |
| `build_show_brief` | Headliner, city, and capacity in; a full brief out (openers with scores, routing, partners, ad plan, audience, copy, link). If the name is ambiguous it returns `needs_choice` with candidates; call again with `headliner_id`. |
| `get_show_brief` | Read a saved or featured brief by id. |
| `ask_undercard` | Edit or question a brief in plain English ("swap opener 2", "go smaller", "what if Omaha, NE?"). City or capacity changes return a new brief id. |
| `list_featured_briefs` | Example briefs that are always available. |

Add it to Cursor (`.cursor/mcp.json`) or any client that speaks Streamable HTTP:

```json
{ "mcpServers": { "undercard": { "url": "http://localhost:3000/api/mcp" } } }
```

Claude Code: `claude mcp add --transport http undercard http://localhost:3000/api/mcp`. Built with `mcp-handler` and the official MCP TypeScript SDK; tested with the SDK's client and in `test/mcp.test.ts`.

## Run it

```bash
pnpm install
cp .env.example .env.local   # add QLOO_API_KEY and one LLM key (OPENROUTER_API_KEY recommended)
pnpm dev
```

Without keys the app runs in demo mode: Qloo responses are simulated with invented names (clearly labeled), and copy is templated. If the LLM provider fails mid-demo, Undercard falls back to templated copy instead of failing the brief.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

The smoke tests run the full brief pipeline, the "Which one?" step, the API routes, and the MCP tools in demo mode, with no keys and no network.

## Stack

Next.js 16, React 19, Tailwind 4, shadcn/ui, MapLibre GL with CARTO basemaps, zod. The LLM layer is any OpenAI-compatible endpoint: OpenRouter free models by default (NVIDIA Nemotron 3 Ultra, with Gemma 4 and Nemotron 3 Super as fallbacks), or Groq, GitHub Models, or Gemini. Every LLM response is cached by prompt hash, retried with backoff on rate limits, and falls back to templates. Featured briefs are precomputed with `pnpm featured` and shipped with the deployment; other briefs are cached on the server.

## Limitations

Qloo results describe aggregate taste affinities. They are not predictions about any individual and are not a guarantee of ticket sales.

## License

MIT
