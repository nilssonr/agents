import type { FastifyInstance } from 'fastify';

import type { LogService } from '../../features/logs/log-service.js';

/**
 * Registers the `/jobs` REST routes for retrieving job-level data such as logs.
 */
export function registerJobRoutes(app: FastifyInstance, deps: { logService: LogService }): void {
    app.get('/jobs/:id/logs', async (request) => {
        const { id } = request.params as { id: string };
        return deps.logService.getLogsForJob(id);
    });
}
