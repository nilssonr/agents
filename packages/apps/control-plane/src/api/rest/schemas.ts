import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/** Schema for the POST /agents request body. */
export const createAgentSchema = z.object({
    name: z.string().min(1, 'name is required'),
    activities: z.array(z.object({
        type: z.string().min(1),
        id: z.string().optional(),
        params: z.unknown().optional(),
        maxRetries: z.number().int().nonnegative().optional(),
        onError: z.record(z.string()).optional(),
    })).optional().default([]),
    failure_threshold: z.number().int().positive().optional().default(3),
});

/** Schema for the POST /agents/:id/invoke request body. */
export const invokeAgentSchema = z.object({
    payload: z.unknown().optional().default(null),
}).passthrough();

/** Schema for the GET /agents/:id/jobs query string. */
export const jobsQuerySchema = z.object({
    status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
});

/** Schema for an agent response matching AgentRow. */
export const agentSchema = z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    activities: z.unknown(),
    failure_threshold: z.number(),
    failure_count: z.number(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
});

/** Schema for a job response matching JobRow. */
export const jobSchema = z.object({
    id: z.string(),
    agent_id: z.string(),
    status: z.string(),
    payload: z.unknown(),
    result: z.unknown(),
    error: z.string().nullable(),
    current_step_id: z.string().nullable(),
    context: z.record(z.unknown()),
    step_retries: z.number(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
});

/** Schema for a log entry response matching LogEntry. */
export const logEntrySchema = z.object({
    id: z.string(),
    job_id: z.string(),
    step_id: z.string().nullable(),
    level: z.string(),
    message: z.string(),
    metadata: z.unknown(),
    created_at: z.string().datetime(),
});

/** RFC 7807 Problem Details schema. */
export const problemDetailSchema = z.object({
    type: z.string(),
    title: z.string(),
    status: z.number(),
    detail: z.string(),
    instance: z.string().optional(),
});

/** Schema for a healthy response. */
export const healthSchema = z.object({
    status: z.literal('ok'),
});

/** Schema for an unhealthy readiness response. */
export const readyErrorSchema = z.object({
    type: z.string(),
    title: z.string(),
    status: z.number(),
    detail: z.string(),
});

/** Converts a Zod schema to JSON Schema suitable for Fastify route definitions. */
export function toJsonSchema(schema: z.ZodType) {
    const { $schema, ...rest } = zodToJsonSchema(schema, { target: 'jsonSchema7' }) as Record<string, unknown>;
    return rest;
}

/** Creates an RFC 7807 Problem Details response object. */
export function createProblemDetail(status: number, title: string, detail: string) {
    return {
        type: 'about:blank',
        title,
        status,
        detail,
    };
}

/** Parses body against schema, throwing a 400-friendly error on failure. */
export function validateBody<T>(schema: z.ZodType<T>, body: unknown): T {
    try {
        return schema.parse(body);
    } catch (err) {
        if (err instanceof z.ZodError) {
            const details = err.errors.map(e => `${e.path.join('.')}: ${e.message}`);
            const wrapped = new Error(`Validation failed: ${details.join('; ')}`);
            wrapped.name = 'ValidationError';
            throw wrapped;
        }
        throw err;
    }
}
