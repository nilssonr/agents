import type { FastifyInstance } from 'fastify';

import type { AgentService } from '../../features/agents/agent-service.js';
import { jobSchema, problemDetailSchema, toJsonSchema, createProblemDetail } from './schemas.js';

/**
 * Registers the `/webhooks/:agentId` route that allows external systems to
 * invoke an agent by posting an arbitrary payload.
 */
export function registerWebhookRoutes(app: FastifyInstance, deps: { agentService: AgentService }): void {
    app.post('/webhooks/:agentId', {
        schema: {
            tags: ['Webhooks'],
            description: 'Invoke an agent via webhook',
            params: { type: 'object', properties: { agentId: { type: 'string' } }, required: ['agentId'] },
            response: {
                202: toJsonSchema(jobSchema),
                404: toJsonSchema(problemDetailSchema),
                409: toJsonSchema(problemDetailSchema),
            },
        },
    }, async (request, reply) => {
        const { agentId } = request.params as { agentId: string };
        try {
            const job = await deps.agentService.invokeAgent(agentId, request.body ?? null);
            return reply.status(202).send(job);
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AgentNotFoundError') {
                return reply.status(404).send(createProblemDetail(404, 'Not Found', err.message));
            }
            if (err instanceof Error && err.name === 'AgentPausedError') {
                return reply.status(409).send(createProblemDetail(409, 'Conflict', err.message));
            }
            throw err;
        }
    });
}
