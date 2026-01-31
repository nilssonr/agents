import type { FastifyInstance } from 'fastify';

import type { AgentService } from '../../features/agents/agent-service.js';
import type { JobService } from '../../features/jobs/job-service.js';

/**
 * Registers the `/agents` REST routes for CRUD, invocation, restart, and job listing.
 */
export function registerAgentRoutes(app: FastifyInstance, deps: { agentService: AgentService; jobService: JobService }): void {
    app.post('/agents', async (request, reply) => {
        const body = request.body as { name: string; activities?: unknown; failure_threshold?: number };
        const agent = await deps.agentService.createAgent(body.name, body.activities ?? [], body.failure_threshold ?? 3);
        return reply.status(201).send(agent);
    });

    app.get('/agents', async () => {
        return deps.agentService.listAgents();
    });

    app.get('/agents/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const agent = await deps.agentService.getAgent(id);
        if (!agent) {
            return reply.status(404).send({ error: 'Agent not found' });
        }
        return agent;
    });

    app.delete('/agents/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        await deps.agentService.deleteAgent(id);
        return reply.status(204).send();
    });

    app.post('/agents/:id/invoke', async (request, reply) => {
        const { id } = request.params as { id: string };
        const payload = request.body ?? null;
        try {
            const job = await deps.agentService.invokeAgent(id, payload);
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

    app.post('/agents/:id/restart', async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            await deps.agentService.restartAgent(id);
            return reply.status(204).send();
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AgentNotFoundError') {
                return reply.status(404).send({ error: err.message });
            }
            throw err;
        }
    });

    app.get('/agents/:id/jobs', async (request) => {
        const { id } = request.params as { id: string };
        const { status } = request.query as { status?: string };
        return deps.jobService.getJobsForAgent(id, status);
    });
}
