import { createServer } from 'nice-grpc';
import type { Server, ServiceImplementation } from 'nice-grpc';

import { WorkerServiceDefinition } from '@agents/contracts';
import type { WorkerServiceImplementation } from '@agents/contracts';

export function startGrpcServer(port: number, impl: WorkerServiceImplementation): Server {
    const server = createServer();
    server.add(
        WorkerServiceDefinition,
        impl as unknown as ServiceImplementation<typeof WorkerServiceDefinition>,
    );
    void server.listen(`0.0.0.0:${String(port)}`);
    return server;
}
