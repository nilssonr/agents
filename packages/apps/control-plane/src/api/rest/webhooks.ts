import type { FastifyInstance } from 'fastify';

import type { AgentService } from '../../features/agents/agent-service.js';

/**
 * Registers the `/webhooks/:agentId` route that allows external systems to
 * invoke an agent by posting an arbitrary payload.
 */
export function registerWebhookRoutes(app: FastifyInstance, deps: { agentService: AgentService }): void {
    app.post('/webhooks/:agentId', async (request, reply) => {
        const { agentId } = request.params as { agentId: string };
        try {
            const job = await deps.agentService.invokeAgent(agentId, request.body ?? null);
            return reply.status(202).send(job);
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AgentNotFoundError') {
                return reply.status(404).send({ error: err.message });
            }
            if (err instanceof Error && err.name === 'AgentPausedError') {
                return reply.status(409).send({ error: err.message });
            }
            throw err;
        }
    });
}
