## Synchronization methods

The prototype currently compares four client-facing synchronization approaches:

- polling
- long polling
- Server-Sent Events (SSE)
- WebSocket

Polling and long polling are request-based approaches where clients repeatedly or conditionally request updates from the backend.

SSE and WebSocket are persistent connection-based approaches where the backend forwards database changes to connected clients.

## Backend event propagation

For event-driven transports, the backend uses PostgreSQL triggers and LISTEN/NOTIFY to detect newly inserted rows in the sync_events table. A dedicated PostgreSQL listener client receives NOTIFY messages and forwards the corresponding events to connected SSE or WebSocket clients.

In this prototype, database-triggered notification is treated as a backend propagation mechanism rather than a separate browser-facing synchronization method.

## Full command list
npm run run:scenario      # Run a single scenario from a selected JSON file
npm run run:batch         # Run all scenarios from a selected folder
npm run analyze           # Generate summary analysis from result files
npm run group:summaries   # Group generated summaries
npm run clean:results     # Clean previous result files
npm start                 # Manually start the backend for development/debugging

## Creating a database
createdb your_database_name
psql -d your_database_name -f sql/schema.sql
psql -d your_database_name -f sql/triggers.sql

## Running the test harness
npm install

## Running experiments

The benchmark runner starts the required local server origins automatically. For normal experiment execution, it is not necessary to start the backend manually with `npm start`.

### Run a single scenario

Run one scenario by providing the path to a scenario JSON file:

npm run run:scenario path/to/scenario.json

Example: 
npm run run:scenario scenarios/websocket_10clients_10rps_1kb.json

## Run a batch of scenarios from a folder

Run a batch of scenarios by running the batch command and providing a path to the batch directory:

npm run run:scenario path/to/directory

Example:
npm run run:batch scenarios/baseline

(Note: by default for experimental purposes during batch runs each scenario is run three times in sequence)

## Analyzing results

Run results can be inspected manually or aggregated into a single .json/.csv file by running `npm run analyze` and then `npm run group:summaries`

This reads the individual JSON summary files from results/summaries/ and creates a flat table in results/aggregated/summary-table.json and results/aggregated/summary-table.csv. Each row represents one generated summary file.

npm run group:summaries

This reads results/aggregated/summary-table.json and groups rows by scenarioId. Repeated runs of the same scenario are collapsed into a single row with averaged latency metrics, producing grouped-summary-table.json and grouped-summary-table.csv.
