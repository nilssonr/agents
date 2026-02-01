import { z } from 'zod';

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
