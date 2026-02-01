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
| POST   | `/agents`               | Create an agent                    |
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

### Webhooks

| Method | Path                    | Description                        |
| ------ | ----------------------- | ---------------------------------- |
| POST   | `/webhooks/:agentId`    | External trigger for an agent      |

## gRPC API

Defined in `packages/libs/contracts/proto/agents/v1/worker.proto`:

- **SubscribeToJobs** — Server-streaming RPC. Worker subscribes and receives `JobAssignment` messages as jobs become available.
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

## Configuration

### Control-Plane

| Variable             | Required | Default | Description                     |
| -------------------- | -------- | ------- | ------------------------------- |
| `DATABASE_URL`       | Yes      | —       | PostgreSQL connection string    |
| `HTTP_PORT`          | No       | —       | REST server port                |
| `GRPC_PORT`          | No       | —       | gRPC server port                |
| `CRON_INTERVAL_MS`   | No       | 60000   | Scheduler tick interval (ms)    |
| `GRPC_POLL_INTERVAL_MS` | No   | 1000    | Job polling interval (ms)       |

### Worker

| Variable        | Required | Default              | Description                      |
| --------------- | -------- | -------------------- | -------------------------------- |
| `GRPC_ADDRESS`  | Yes      | —                    | Control-plane gRPC endpoint      |
| `WORKER_ID`     | No       | `worker-{timestamp}` | Unique worker identifier         |

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
