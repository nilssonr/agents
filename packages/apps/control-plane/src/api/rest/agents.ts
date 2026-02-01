import type { FastifyInstance } from 'fastify';

import type { AgentService } from '../../features/agents/agent-service.js';
import type { JobService } from '../../features/jobs/job-service.js';
import {
    createAgentSchema, invokeAgentSchema, jobsQuerySchema, validateBody,
    agentSchema, jobSchema, problemDetailSchema, toJsonSchema, createProblemDetail,
} from './schemas.js';

/**
 * Registers the `/agents` REST routes for CRUD, invocation, restart, and job listing.
 */
export function registerAgentRoutes(app: FastifyInstance, deps: { agentService: AgentService; jobService: JobService }): void {
    app.post('/agents', {
        schema: {
            tags: ['Agents'],
            description: 'Create a new agent',
            body: toJsonSchema(createAgentSchema),
            response: {
                201: toJsonSchema(agentSchema),
                400: toJsonSchema(problemDetailSchema),
            },
        },
    }, async (request, reply) => {
        const body = validateBody(createAgentSchema, request.body);
        const agent = await deps.agentService.createAgent(body.name, body.activities ?? [], body.failure_threshold ?? 3);
        return reply.status(201).send(agent);
    });

    app.get('/agents', {
        schema: {
            tags: ['Agents'],
            description: 'List all agents',
            response: {
                200: { type: 'array', items: toJsonSchema(agentSchema) },
            },
        },
    }, async () => {
        return deps.agentService.listAgents();
    });

    app.get('/agents/:id', {
        schema: {
            tags: ['Agents'],
            description: 'Get an agent by ID',
            params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
            response: {
                200: toJsonSchema(agentSchema),
                404: toJsonSchema(problemDetailSchema),
            },
        },
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const agent = await deps.agentService.getAgent(id);
        if (!agent) {
            return reply.status(404).send(createProblemDetail(404, 'Not Found', 'Agent not found'));
        }
        return agent;
    });

    app.delete('/agents/:id', {
        schema: {
            tags: ['Agents'],
            description: 'Delete an agent',
            params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
            response: { 204: { type: 'null', description: 'Agent deleted' } },
        },
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        await deps.agentService.deleteAgent(id);
        return reply.status(204).send();
    });

    app.post('/agents/:id/invoke', {
        schema: {
            tags: ['Agents'],
            description: 'Invoke an agent to create a new job',
            params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
            body: toJsonSchema(invokeAgentSchema),
            response: {
                202: toJsonSchema(jobSchema),
                404: toJsonSchema(problemDetailSchema),
                409: toJsonSchema(problemDetailSchema),
            },
        },
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const parsed = validateBody(invokeAgentSchema, request.body ?? {});
        const payload = parsed.payload ?? null;
        try {
            const job = await deps.agentService.invokeAgent(id, payload);
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

    app.post('/agents/:id/restart', {
        schema: {
            tags: ['Agents'],
            description: 'Restart a paused agent',
            params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
            response: {
                204: { type: 'null', description: 'Agent restarted' },
                404: toJsonSchema(problemDetailSchema),
            },
        },
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            await deps.agentService.restartAgent(id);
            return reply.status(204).send();
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AgentNotFoundError') {
                return reply.status(404).send(createProblemDetail(404, 'Not Found', err.message));
            }
            throw err;
        }
    });

    app.get('/agents/:id/jobs', {
        schema: {
            tags: ['Agents'],
            description: 'List jobs for an agent, optionally filtered by status',
            params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
            querystring: toJsonSchema(jobsQuerySchema),
            response: {
                200: { type: 'array', items: toJsonSchema(jobSchema) },
            },
        },
    }, async (request) => {
        const { id } = request.params as { id: string };
        const query = validateBody(jobsQuerySchema, request.query);
        return deps.jobService.getJobsForAgent(id, query.status);
    });
}
