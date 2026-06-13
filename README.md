# Real-Time Database-to-Client Synchronization Latency Benchmark

A benchmarking harness that measures and compares **full database-to-client end-to-end (E2E) latency** across four real-time synchronization approaches - polling, long polling, Server-Sent Events (SSE), and WebSocket - under varying client counts and message sizes.

## Overview

The harness drives real Chromium clients with Playwright and measures how long it takes for a change committed in the database to become visible at the client, across four different transport strategies and a matrix of load conditions.

## Why measure end-to-end from the database

The latency clock starts at the **database commit**, not at the server's response. This is deliberate.

Measuring only server-to-client round-trips would flatter polling: a single poll response is fast in isolation, but the latency that actually matters is the wait *until the next poll*. Anchoring the measurement at the database change captures that dead time for request-driven approaches, the `LISTEN`/`NOTIFY` propagation time for event-driven ones, and the transport overhead - all in one comparable unit. This is what makes the four approaches fairly comparable rather than measuring four subtly different things.

## How it works

- A PostgreSQL trigger fires on inserts to the `sync_events` table and emits `NOTIFY`.
- A dedicated listener client receives these `NOTIFY` messages and forwards events to connected SSE/WebSocket clients.
- Polling and long polling query for new events on the request-driven path.
- Client-side latency is measured using real Chromium clients driven by Playwright, capturing **browser-observed** latency rather than server-side timing alone.

## Test setup

| Parameter | Values |
|---|---|
| Transports | polling, long polling, SSE, WebSocket |
| Client counts | 1, 10, 50, 100 |
| Message sizes | 1 KB, 10 KB, 50 KB |
| Event rate | 10 events/second (constant) |
| Warm-up | 5 s |
| Measurement window | 30 s |
| Configurations | 48 (4 × 4 × 3) |
| Runs per configuration | 3 (144 runs total) |

Grouped summaries average the three repetitions per configuration. Reported percentiles (P50, P90, P99) are averages of the per-run percentiles rather than percentiles recomputed over all raw measurements pooled together.

## Results

Median (P50) E2E latency at the **50 KB** message size, in milliseconds:

| Approach | 1 client | 10 clients | 50 clients | 100 clients |
|---|--:|--:|--:|--:|
| Polling | 507.8 | 504.2 | 507.6 | 513.7 |
| Long polling | 4.1 | 7.5 | 29.6 | 68.5 |
| SSE | 2.7 | 3.3 | 7.9 | 15.1 |
| WebSocket | 3.3 | 11.6 | 51.8 | 5295.8 ⚠️ |

> ⚠️ The WebSocket value at 100 clients / 50 KB is an outlier treated as an **overload/instability case of this prototype's synchronous broadcast loop**, not a general property of the protocol. See *Scope and limitations*. The same combination shows P90 ≈ 19,906 ms and P99 ≈ 24,087 ms, indicating the degradation affected a broad share of measurements rather than only the worst 1%.

### Key findings

- **SSE was the most suitable approach** for this database-to-client delivery pattern, with the lowest and most consistent latency across percentiles. At 50 KB / 100 clients its P50 was ~15 ms and P99 ~31 ms.
- **Polling** held steady around ~500 ms at P50 regardless of load - its latency is dominated by the fixed ~1000 ms poll interval, not by client count or message size.
- **Long polling** improved substantially on polling (single-digit-ms P50 at low load) but degraded with client count, reaching tens of milliseconds at 100 clients as the server juggled more held requests.
- **WebSocket** matched SSE at low load but was the most sensitive to message size; at the heaviest combination (50 KB / 100 clients) it showed a severe latency spike, attributed to the synchronous server-side broadcast loop rather than the protocol itself.

## Scope and limitations

- All components run on a **single machine**, with **no containerization** and **no simulated/artificial network latency**. Results reflect the *relative* behavior of the transports in this environment rather than absolute production figures.
- The WebSocket broadcast path is a **synchronous send loop**; an async/batched implementation would likely change its high-load behavior.
- The benchmark exercises a **one-directional database→client** delivery scenario and does not test client→server communication, where WebSocket's bidirectional nature would matter more.

---

## Synchronization methods

The prototype compares four client-facing synchronization approaches:

- polling
- long polling
- Server-Sent Events (SSE)
- WebSocket

Polling and long polling are request-based approaches where clients repeatedly or conditionally request updates from the backend.

SSE and WebSocket are persistent connection-based approaches where the backend forwards database changes to connected clients.

## Backend event propagation

For event-driven transports, the backend uses PostgreSQL triggers and `LISTEN`/`NOTIFY` to detect newly inserted rows in the `sync_events` table. A dedicated PostgreSQL listener client receives `NOTIFY` messages and forwards the corresponding events to connected SSE or WebSocket clients.

In this prototype, database-triggered notification is treated as a backend propagation mechanism rather than a separate browser-facing synchronization method.

## Getting started

### Install dependencies

```bash
npm install
```

### Create a database

```bash
createdb your_database_name
psql -d your_database_name -f sql/schema.sql
psql -d your_database_name -f sql/triggers.sql
```

## Running experiments

The benchmark runner starts the required local server origins automatically. For normal experiment execution, it is not necessary to start the backend manually with `npm start`.

### Run a single scenario

Provide the path to a scenario JSON file:

```bash
npm run run:scenario path/to/scenario.json
```

Example:

```bash
npm run run:scenario scenarios/websocket_10clients_10eps_1kb.json
```

### Run a batch of scenarios from a folder

Provide a path to the batch directory:

```bash
npm run run:batch path/to/directory
```

Example:

```bash
npm run run:batch scenarios/baseline
```

> By default, during batch runs each scenario is run three times in sequence.

## Analyzing results

Results can be inspected manually or aggregated into a single `.json`/`.csv` file by running `npm run analyze` followed by `npm run group:summaries`.

```bash
npm run analyze
```

This reads the individual JSON summary files from `results/summaries/` and creates a flat table in `results/aggregated/summary-table.json` and `results/aggregated/summary-table.csv`. Each row represents one generated summary file.

```bash
npm run group:summaries
```

This reads `results/aggregated/summary-table.json` and groups rows by `scenarioId`. Repeated runs of the same scenario are collapsed into a single row with averaged latency metrics, producing `grouped-summary-table.json` and `grouped-summary-table.csv`.

## Command reference

```bash
npm run run:scenario      # Run a single scenario from a selected JSON file
npm run run:batch         # Run all scenarios from a selected folder
npm run analyze           # Generate summary analysis from result files
npm run group:summaries   # Group generated summaries
npm run clean:results     # Clean previous result files
npm start                 # Manually start the backend for development/debugging
```

---
