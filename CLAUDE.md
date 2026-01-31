# Rules

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

## Code style

- All exported functions, classes, and interfaces must have JSDoc comments explaining what they do.
- Use factory functions (`createXxx`) rather than classes for services and repositories.
- Test fakes live next to the interface they implement (e.g. `fake-agent-repository.ts` beside `agent-repository.ts`).
- Tests use colocated `.test.ts` files next to the source they test.

## Verification

Always run `pnpm build && pnpm test` after changes. Currently 48 tests across 10 test files.
