import type { FastifyInstance } from 'fastify';

import type { JobService } from '../../features/jobs/job-service.js';
import type { LogService } from '../../features/logs/log-service.js';

import { createProblemDetail, jobSchema, logEntrySchema, problemDetailSchema, toJsonSchema } from './schemas.js';

/**
 * Registers the `/jobs` REST routes for retrieving job-level data such as logs.
 */
export function registerJobRoutes(
    app: FastifyInstance,
    deps: { jobService: JobService; logService: LogService },
): void {
    app.get(
        '/jobs/:id',
        {
            schema: {
                tags: ['Jobs'],
                description: 'Get a job by ID',
                params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
                response: {
                    200: toJsonSchema(jobSchema),
                    404: toJsonSchema(problemDetailSchema),
                },
            },
        },
        async (request, reply) => {
            const { id } = request.params as { id: string };
            const job = await deps.jobService.getJob(id);
            if (!job) {
                return reply
                    .status(404)
                    .header('content-type', 'application/problem+json')
                    .send(createProblemDetail(404, 'Not Found', `Job ${id} not found`));
            }
            return job;
        },
    );

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
