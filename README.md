# Agents

An agent orchestration platform for defining, scheduling, and executing multi-step workflows. Agents are stateful executors that run activities (HTTP requests, logging, custom logic) through configurable flows with built-in retry handling, error routing, and failure tracking.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 control-plane                    │
│                                                  │
│  REST API (Fastify)     gRPC Server (nice-grpc)  │
│  ┌──────────────┐       ┌────────────────────┐   │
│  │ /agents      │       │ SubscribeToJobs    │   │
│  │ /jobs        │       │ ReportJobResult    │   │
│  │ /webhooks    │       └─────────┬──────────┘   │
│  └──────┬───────┘                 │              │
│         │         ┌───────────────┘              │
│         ▼         ▼                              │
│  ┌─────────────────────┐  ┌──────────────────┐   │
│  │ Agent / Job / Flow  │  │  Cron Scheduler  │   │
│  │     Services        │  └──────────────────┘   │
│  └─────────┬───────────┘                         │
│            ▼                                     │
│  ┌─────────────────────┐                         │
│  │    PostgreSQL 17     │                         │
│  └─────────────────────┘                         │
└─────────────────────────────────────────────────┘
                     ▲
                     │ gRPC streaming
                     ▼
┌─────────────────────────────────────────────────┐
│                    worker                        │
│                                                  │
│  ┌─────────────────────────────────────────┐     │
│  │           Activity Registry             │     │
│  │  noop · http-request · log              │     │
│  └─────────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

The **control-plane** manages agents, schedules jobs, orchestrates multi-step flows, and streams work assignments to workers via gRPC. **Workers** poll for jobs, execute activities, collect structured logs, and report results back.

## Tech Stack

| Layer       | Technology                           |
| ----------- | ------------------------------------ |
| Runtime     | Node.js (ES modules)                 |
| Language    | TypeScript 5.7                       |
| REST API    | Fastify 5                            |
| gRPC        | nice-grpc 2 + Protobuf (buf/ts-proto)|
| Database    | PostgreSQL 17                        |
| SQL codegen | sqlc                                 |
| Validation  | Zod                                  |
| Scheduling  | croner                               |
| Logging     | pino                                 |
| Testing     | Vitest                               |
| Monorepo    | pnpm workspaces                      |

## Project Structure

```
packages/
  apps/
    control-plane/       # REST + gRPC API, scheduling, agent/job orchestration
      src/
        features/        # Domain logic per bounded context
          agents/        # Agent CRUD, invocation, failure tracking
          jobs/          # Job lifecycle, step routing
          flows/         # Multi-step flow parsing and transitions
          logs/          # Activity log persistence
          triggers/      # Cron/webhook trigger definitions
          scheduler/     # Cron-based job scheduling
        adapters/
          postgres/      # PostgreSQL repository implementations
        api/
          rest/          # Fastify route handlers
          grpc/          # gRPC WorkerService implementation
        app.ts           # Composition root
        index.ts         # Entry point
      sql/
        schema.sql       # Database schema
        migrations/      # Versioned SQL migrations
    worker/              # Connects to control-plane, executes activities
      src/
        features/
          activities/    # Activity registry, http-request, log, noop
        adapters/
          grpc/          # gRPC client with reconnection
        app.ts           # Composition root
        index.ts         # Entry point
  libs/
    config/              # Env-based config loader
    contracts/           # Protobuf definitions + generated gRPC types
    logger/              # Structured logger (pino)
    metrics/             # Shared Prometheus metrics server
    migrations/          # SQL migration runner
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL)

### Setup

```bash
# Install dependencies
pnpm install

# Start PostgreSQL
pnpm docker:up

# Create a .env file for the control-plane
cat > packages/apps/control-plane/.env <<EOF
DATABASE_URL=postgres://agents:agents@localhost:5444/agents
HTTP_PORT=3000
GRPC_PORT=50051
EOF

# Create a .env file for the worker
cat > packages/apps/worker/.env <<EOF
GRPC_ADDRESS=localhost:50051
WORKER_ID=worker-1
EOF

# Build all packages
pnpm build

# Run both control-plane and worker in dev mode (with watch)
pnpm dev
```

### Verify

```bash
# Run tests
pnpm test

# Build
pnpm build

# Lint & format
pnpm lint
pnpm format:check
```

## Database Schema

Four tables in PostgreSQL:

- **agents** — Stateful executors with activity definitions, failure tracking, and status (`active`/`paused`)
- **jobs** — Work items linked to agents with status (`pending`/`running`/`completed`/`failed`), multi-step context, and retry tracking
- **triggers** — Cron or webhook triggers attached to agents
- **job_logs** — Structured log entries collected during job execution

Migrations run automatically on control-plane startup.

## REST API

### Agents

| Method | Path                    | Description                        |
| ------ | ----------------------- | ---------------------------------- |
| POST   | `/agents`               | Create an agent (Zod-validated)    |
| GET    | `/agents`               | List all agents                    |
| GET    | `/agents/:id`           | Get an agent                       |
| DELETE | `/agents/:id`           | Delete an agent                    |
| POST   | `/agents/:id/invoke`    | Invoke an agent (create a job)     |
| POST   | `/agents/:id/restart`   | Restart a paused agent             |
| GET    | `/agents/:id/jobs`      | List jobs for an agent             |

### Jobs

| Method | Path              | Description              |
| ------ | ----------------- | ------------------------ |
| GET    | `/jobs/:id/logs`  | Get logs for a job       |

### Health

| Method | Path       | Description                                  |
| ------ | ---------- | -------------------------------------------- |
| GET    | `/health`  | Liveness probe (always 200)                  |
| GET    | `/ready`   | Readiness probe (DB ping, 200 or 503)        |

### Metrics

Both control-plane and worker serve Prometheus metrics on a dedicated `METRICS_PORT` (default 9090) via the `@agents/metrics` shared library, separate from REST/gRPC ports. Histograms use explicit buckets tuned for p95/p99 percentile resolution.

### Webhooks

| Method | Path                    | Description                        |
| ------ | ----------------------- | ---------------------------------- |
| POST   | `/webhooks/:agentId`    | External trigger for an agent      |

## gRPC API

Defined in `packages/libs/contracts/proto/agents/v1/worker.proto`:

- **SubscribeToJobs** — Server-streaming RPC. Worker subscribes with capabilities and receives `JobAssignment` messages as matching jobs become available.
- **ReportJobResult** — Unary RPC. Worker reports success/failure, result data, and collected logs.

## Multi-Step Flows

Agents can define multi-step activity flows. Each step specifies an activity type, parameters, optional retry limits, and error handlers:

```json
[
  {
    "type": "http-request",
    "params": {
      "method": { "type": "literal", "value": "GET" },
      "url": { "type": "literal", "value": "https://api.example.com/data" }
    },
    "maxRetries": 2,
    "onError": { "default": "notify" }
  },
  {
    "id": "notify",
    "type": "log",
    "params": {
      "message": { "type": "context", "ref": "step_0.body.message" },
      "level": { "type": "literal", "value": "warn" }
    }
  }
]
```

**Step routing:**
- On success, a step can return `{ next: "step_id" }` to route to a specific step, or complete the flow
- On failure, the system checks `maxRetries`, then `onError` handlers (by error type or `default`), then fails the job
- Step results accumulate in a flow context, accessible by subsequent steps via `{ "type": "context", "ref": "step_0.body.field" }` value references

## Built-in Activities

| Activity        | Description                                                         |
| --------------- | ------------------------------------------------------------------- |
| `noop`          | No-op placeholder, returns `{ ok: true }`                           |
| `http-request`  | Zod-validated HTTP client with context-aware parameter resolution    |
| `log`           | Emits a structured log entry at a specified level                   |

## Fault Tolerance

- **Agent failure tracking** — Agents track consecutive failures and auto-pause when exceeding a configurable threshold
- **Step retries** — Individual flow steps support `maxRetries` before falling through to error handlers
- **Error routing** — Steps can define `onError` handlers that route to recovery steps by error type
- **Worker reconnection** — Workers reconnect to the control-plane with exponential backoff (1s to 30s)
- **Job reaper** — Background process detects jobs stuck in `running` state beyond a configurable TTL and marks them as failed
- **Activity timeout** — Individual activity executions are bounded by a configurable timeout (default 60s)
- **Graceful shutdown** — Workers drain in-flight activities before exiting, with a configurable grace period
- **Persistent scheduler state** — Cron trigger `last_fired_at` is persisted to the database, surviving control-plane restarts
- **Transaction boundaries** — `withTransaction` helper ensures atomic multi-statement database operations
- **Health checks** — `GET /health` (liveness) and `GET /ready` (readiness with DB ping) for container orchestrators
- **Prometheus metrics** — Job counters, duration histograms (p95/p99 buckets), active gauge, scheduler ticks, gRPC assignments (control-plane); activity totals/duration, job totals/duration, reconnect counter, connected gauge (worker)
- **Configurable DB pool** — Pool sizing and timeout parameters for production tuning
- **Input validation** — Zod-based REST request body validation with structured 400 error responses
- **Context size limits** — Flow context is bounded by a configurable maximum size (default 1 MB), preventing unbounded memory growth
- **Worker concurrency** — Configurable concurrent activity execution per worker (default 1, sequential)
- **Capabilities-based routing** — Workers advertise their registered activity types; control-plane only assigns matching jobs

## Configuration

### Control-Plane

| Variable             | Required | Default | Description                     |
| -------------------- | -------- | ------- | ------------------------------- |
| `DATABASE_URL`       | Yes      | —       | PostgreSQL connection string    |
| `DB_POOL_MIN`        | No       | 2       | Minimum pool connections        |
| `DB_POOL_MAX`        | No       | 10      | Maximum pool connections        |
| `DB_CONNECTION_TIMEOUT_MS` | No | 5000    | Connection acquire timeout (ms) |
| `DB_IDLE_TIMEOUT_MS` | No       | 30000   | Idle connection timeout (ms)    |
| `HTTP_PORT`          | No       | —       | REST server port                |
| `GRPC_PORT`          | No       | —       | gRPC server port                |
| `CRON_INTERVAL_MS`   | No       | 60000   | Scheduler tick interval (ms)    |
| `JOB_REAPER_TTL_MS`  | No       | 300000  | Time before a running job is considered stuck (ms) |
| `JOB_REAPER_INTERVAL_MS` | No  | 60000   | Job reaper tick interval (ms)   |
| `GRPC_POLL_INTERVAL_MS` | No   | 1000    | Job polling interval (ms)       |
| `METRICS_PORT`       | No       | 9090    | Prometheus metrics HTTP server port |
| `MAX_CONTEXT_SIZE_BYTES` | No  | 1048576 | Maximum flow context size in bytes  |

### Worker

| Variable        | Required | Default              | Description                      |
| --------------- | -------- | -------------------- | -------------------------------- |
| `GRPC_ADDRESS`  | Yes      | —                    | Control-plane gRPC endpoint      |
| `WORKER_ID`     | No       | `worker-{timestamp}` | Unique worker identifier         |
| `ACTIVITY_TIMEOUT_MS` | No | 60000              | Max time for a single activity execution (ms) |
| `SHUTDOWN_GRACE_MS` | No   | 10000              | Grace period for in-flight work on shutdown (ms) |
| `METRICS_PORT`  | No       | 9090               | Worker metrics HTTP server port  |
| `WORKER_CONCURRENCY` | No  | 1                  | Max concurrent activity executions |

## Development

```bash
# Dev mode with file watching (runs both apps in parallel)
pnpm dev

# Build all packages
pnpm build

# Run all tests
pnpm test

# Start/stop PostgreSQL
pnpm docker:up
pnpm docker:down

# Regenerate Protobuf types (after editing .proto files)
cd packages/libs/contracts && pnpm run generate
```
