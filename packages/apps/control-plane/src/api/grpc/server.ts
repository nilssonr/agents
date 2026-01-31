import { createServer } from 'nice-grpc';
import type { Server, ServiceImplementation } from 'nice-grpc';

import { WorkerServiceDefinition } from '@agents/contracts';
import type { WorkerServiceImplementation } from '@agents/contracts';

/**
 * Creates and starts a gRPC server that exposes the WorkerService on the given port.
 * The returned server handle can be used to shut down the server gracefully.
 */
export function startGrpcServer(port: number, impl: WorkerServiceImplementation): Server {
    const server = createServer();
    server.add(
        WorkerServiceDefinition,
        impl as unknown as ServiceImplementation<typeof WorkerServiceDefinition>,
    );
    void server.listen(`0.0.0.0:${String(port)}`);
    return server;
}
