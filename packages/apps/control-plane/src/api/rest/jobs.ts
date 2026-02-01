import type { FastifyInstance } from 'fastify';

import type { LogService } from '../../features/logs/log-service.js';

import { logEntrySchema, toJsonSchema } from './schemas.js';

/**
 * Registers the `/jobs` REST routes for retrieving job-level data such as logs.
 */
export function registerJobRoutes(app: FastifyInstance, deps: { logService: LogService }): void {
    app.get(
        '/jobs/:id/logs',
        {
            schema: {
                tags: ['Jobs'],
                description: 'Get logs for a job',
                params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
                response: {
                    200: { type: 'array', items: toJsonSchema(logEntrySchema) },
                },
            },
        },
        async (request) => {
            const { id } = request.params as { id: string };
            return deps.logService.getLogsForJob(id);
        },
    );
}
