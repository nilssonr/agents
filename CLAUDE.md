# Rules

## Documentation maintenance

When making changes to the codebase, update these files to reflect the changes:

- **CLAUDE.md** (this file) — Update test counts, feature lists, domain model, API endpoints, configuration, or any section affected by the change.
- **README.md** — Update user-facing documentation: API tables, architecture diagram, getting started instructions, configuration tables, activity list, or any section affected by the change.

## Generated files — DO NOT MODIFY

Never edit, write, or format the following (reading is fine):

- `pnpm-lock.yaml`
- `**/dist/**`
- `**/generated/**`
- `**/db/**` (sqlc output)

These are generated artifacts. They may still need to be committed — just never modified by hand.

## Project structure

Monorepo managed with pnpm workspaces.

```
packages/
  apps/
    control-plane/     # REST + gRPC API, scheduling, agent/job orchestration
    worker/            # Connects to control-plane, executes activities
  libs/
    config/            # Env-based config loader
    contracts/         # Protobuf-generated gRPC types
    logger/            # Structured logger (pino)
    migrations/        # SQL migration runner
```

## App layout conventions

Each app under `packages/apps/` follows this layout inside `src/`:

```
features/          # Domain logic, one directory per bounded context
  <feature>/
    <name>-service.ts          # Business logic (pure, no I/O framework deps)
    <name>-service.test.ts
    <name>-repository.ts       # Repository interface + row type
    fake-<name>-repository.ts  # In-memory test fake
adapters/          # Infrastructure implementations (DB, external clients)
  postgres/
    pg-<name>-repository.ts    # PostgreSQL repository implementation
  grpc/                        # gRPC client adapters (worker only)
api/               # Exposed APIs — features must NOT import from here
  rest/
    server.ts                  # Fastify instance creation + route registration
    <resource>.ts              # Route handlers grouped by resource
    <resource>.test.ts
  grpc/
    server.ts                  # gRPC server bootstrap
    <name>-impl.ts             # gRPC service implementation
    <name>.test.ts
app.ts             # Wires all dependencies, returns { start(), shutdown() }
index.ts           # Creates the app, starts it, handles process signals
```

### Key rules

- **features/** contains domain logic and repository interfaces. No framework dependencies.
- **adapters/** contains infrastructure implementations (postgres, external gRPC clients). Implements interfaces defined in features.
- **api/** contains exposed server endpoints (REST, gRPC). Features must never import from api/. Only app.ts wires api/ to features/.
- **app.ts** is the composition root. It wires config → infrastructure → features → api and exposes a clean `start()` / `shutdown()` interface.
- **index.ts** is minimal: create app, start, handle signals.

## Domain model

### Control-plane features

| Feature | Location | Description |
|---------|----------|-------------|
| **agents** | `control-plane/src/features/agents/` | Agent CRUD, invocation, failure tracking (auto-pause at threshold), restart |
| **jobs** | `control-plane/src/features/jobs/` | Job lifecycle: claim, complete, fail, multi-step routing via flow service |
| **flows** | `control-plane/src/features/flows/` | Multi-step orchestration: step parsing, success/failure transitions, retry logic, error handlers |
| **logs** | `control-plane/src/features/logs/` | Batch append and retrieval of structured job execution logs |
| **triggers** | `control-plane/src/features/triggers/` | Cron and webhook trigger definitions attached to agents |
| **scheduler** | `control-plane/src/features/scheduler/` | Polling-based cron scheduler that evaluates triggers and invokes agents |

### Worker features

| Feature | Location | Description |
|---------|----------|-------------|
| **activities** | `worker/src/features/activities/` | Activity registry with built-in activities: `noop`, `http-request`, `log` |

### Database tables

- **agents** — `id`, `name`, `status` (active/paused), `activities` (JSONB flow definition), `failure_threshold`, `failure_count`
- **jobs** — `id`, `agent_id`, `status` (pending/running/completed/failed), `payload`, `result`, `error`, `current_step_id`, `context`, `step_retries`
- **triggers** — `id`, `agent_id`, `kind` (cron/webhook), `cron_expression`
- **job_logs** — `id`, `job_id`, `step_id`, `level`, `message`, `metadata`

Schema lives in `control-plane/sql/schema.sql`. Migrations in `control-plane/sql/migrations/` using `-- migrate:up` / `-- migrate:down` markers. Migrations run automatically on startup.

### Key domain types

- **AgentRow** — `{ id, name, status, activities, failure_threshold, failure_count, created_at, updated_at }`
- **JobRow** — `{ id, agent_id, status, payload, result, error, current_step_id, context, step_retries, created_at, updated_at }`
- **FlowStep** — `{ id, type, params?, maxRetries?, onError? }`
- **FlowContext** — `{ [stepId]: result }` — accumulated step outputs
- **ValueSource\<T\>** — `{ type: 'literal', value: T }` or `{ type: 'context', ref: string }` for dot-path context lookup
- **ActivityFn** — `(params, payload, context, logger) => Promise<unknown>`

### Error classes

- `AgentNotFoundError` → mapped to HTTP 404
- `AgentPausedError` → mapped to HTTP 409

## REST API endpoints

### Agents

- `POST /agents` — Create agent (body: `{ name, activities?, failure_threshold? }`) → 201
- `GET /agents` — List all agents
- `GET /agents/:id` — Get agent
- `DELETE /agents/:id` — Delete agent
- `POST /agents/:id/invoke` — Invoke agent (body: arbitrary payload) → 202
- `POST /agents/:id/restart` — Reset failure counter, set status to active
- `GET /agents/:id/jobs` — List jobs (query: `?status=pending|running|completed|failed`)

### Jobs

- `GET /jobs/:id/logs` — Get logs for a job

### Webhooks

- `POST /webhooks/:agentId` — External trigger endpoint

## gRPC API

Defined in `packages/libs/contracts/proto/agents/v1/worker.proto`:

- **SubscribeToJobs(SubscribeRequest) → stream JobAssignment** — Worker subscribes; control-plane polls agents and streams assignments
- **ReportJobResult(JobResult) → JobAck** — Worker reports step/job result with optional logs

## Dependency wiring

`app.ts` is the composition root. Wiring order:

1. `loadConfig()` from `@agents/config`
2. `pg.Pool` with `DATABASE_URL`
3. `createMigrationRunner()` → `migrationRunner.up()` on start
4. Repositories: `createPgAgentRepository`, `createPgJobRepository`, `createPgLogRepository`, `createPgTriggerRepository`
5. Services: `createFlowService`, `createAgentService(agentRepo, jobRepo)`, `createJobService(jobRepo, agentRepo, agentService.handleJobFailure, flowService)`, `createLogService(logRepo)`
6. `createCronScheduler(triggerRepo, agentService, intervalMs)`
7. `buildRestServer({ agentService, jobService, logService })`
8. `createWorkerServiceImpl(agentService, jobService, logService, flowService, options)` → gRPC server

The circular dependency between `AgentService` and `JobService` is broken by passing `agentService.handleJobFailure` as a callback.

## Configuration

### Control-plane environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `HTTP_PORT` | No | — | REST server port |
| `GRPC_PORT` | No | — | gRPC server port |
| `CRON_INTERVAL_MS` | No | 60000 | Scheduler tick interval (ms) |
| `GRPC_POLL_INTERVAL_MS` | No | 1000 | Job polling interval (ms) |

### Worker environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GRPC_ADDRESS` | Yes | — | Control-plane gRPC endpoint |
| `WORKER_ID` | No | `worker-{timestamp}` | Unique worker identifier |

## Code style

- All exported functions, classes, and interfaces must have JSDoc comments explaining what they do.
- Use factory functions (`createXxx`) rather than classes for services and repositories.
- Repository interfaces define both the row type (`XxxRow`) and the repository interface (`XxxRepository`) in the same file.
- Test fakes live next to the interface they implement (e.g. `fake-agent-repository.ts` beside `agent-repository.ts`). Fakes expose their internal array (e.g. `.agents`) for direct assertion in tests.
- Tests use colocated `.test.ts` files next to the source they test.
- Custom error classes extend `Error`, set `this.name`, and are caught by name in REST routes to map to HTTP status codes.
- No `any` types in service/repository code. Use `unknown` and validate with Zod at boundaries.
- PostgreSQL adapters use `toXxxRow()` converter functions to map sqlc output to domain row types.

## Testing patterns

- **Framework:** Vitest (`describe`/`it`/`expect`)
- **Unit tests:** Factory-create fakes + service under test in `beforeEach`. Assert via service methods or fake's exposed internal arrays.
- **REST integration tests:** `buildRestServer()` with fakes, call `app.inject()`, assert status code and JSON body.
- **Activity tests:** `vi.fn()` mocks for fetch, pass mock to factory `createHttpRequestActivity(mockFetch)`.
- **Worker client tests:** Fake gRPC client and activity registry for isolation; test reconnection with simulated connection drops.

## Verification

Always run `pnpm build && pnpm test` after changes. Currently 112 tests across 20 test files.
