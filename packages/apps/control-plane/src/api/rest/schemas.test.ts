import { describe, expect, it } from 'vitest';

import {
    createAgentSchema,
    invokeAgentSchema,
    jobsQuerySchema,
    validateBody,
    agentSchema,
    jobSchema,
    logEntrySchema,
    problemDetailSchema,
    healthSchema,
    readyErrorSchema,
    toJsonSchema,
    createProblemDetail,
} from './schemas.js';

describe('createAgentSchema', () => {
    it('rejects missing name', () => {
        const result = createAgentSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
        const result = createAgentSchema.safeParse({ name: '' });
        expect(result.success).toBe(false);
    });

    it('rejects negative failure_threshold', () => {
        const result = createAgentSchema.safeParse({ name: 'a', failure_threshold: -1 });
        expect(result.success).toBe(false);
    });

    it('accepts minimal body', () => {
        const result = createAgentSchema.safeParse({ name: 'foo' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.activities).toEqual([]);
            expect(result.data.failure_threshold).toBe(3);
        }
    });

    it('accepts full body with activities', () => {
        const result = createAgentSchema.safeParse({
            name: 'agent',
            activities: [{ type: 'http-request', id: 'step1', params: { url: 'http://example.com' } }],
            failure_threshold: 5,
        });
        expect(result.success).toBe(true);
    });
});

describe('invokeAgentSchema', () => {
    it('accepts null payload', () => {
        const result = invokeAgentSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('accepts object payload', () => {
        const result = invokeAgentSchema.safeParse({ payload: { data: 'test' } });
        expect(result.success).toBe(true);
    });
});

describe('jobsQuerySchema', () => {
    it('rejects invalid status', () => {
        const result = jobsQuerySchema.safeParse({ status: 'invalid' });
        expect(result.success).toBe(false);
    });

    it('accepts valid status', () => {
        const result = jobsQuerySchema.safeParse({ status: 'pending' });
        expect(result.success).toBe(true);
    });

    it('accepts empty query', () => {
        const result = jobsQuerySchema.safeParse({});
        expect(result.success).toBe(true);
    });
});

describe('validateBody', () => {
    it('throws ValidationError on failure', () => {
        expect(() => validateBody(createAgentSchema, {})).toThrow('Validation failed');
        try {
            validateBody(createAgentSchema, {});
        } catch (err) {
            expect((err as Error).name).toBe('ValidationError');
        }
    });

    it('returns parsed data on success', () => {
        const data = validateBody(createAgentSchema, { name: 'test' });
        expect(data.name).toBe('test');
    });
});

describe('response schemas', () => {
    it('agentSchema validates a complete agent', () => {
        const result = agentSchema.safeParse({
            id: '1',
            name: 'a',
            status: 'active',
            activities: [],
            failure_threshold: 3,
            failure_count: 0,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
        });
        expect(result.success).toBe(true);
    });

    it('jobSchema validates a complete job', () => {
        const result = jobSchema.safeParse({
            id: '1',
            agent_id: '2',
            status: 'pending',
            payload: null,
            result: null,
            error: null,
            current_step_id: null,
            context: {},
            step_retries: 0,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
        });
        expect(result.success).toBe(true);
    });

    it('logEntrySchema validates a log entry', () => {
        const result = logEntrySchema.safeParse({
            id: '1',
            job_id: '2',
            step_id: null,
            level: 'info',
            message: 'hello',
            metadata: {},
            created_at: '2024-01-01T00:00:00Z',
        });
        expect(result.success).toBe(true);
    });

    it('problemDetailSchema validates RFC 7807', () => {
        const result = problemDetailSchema.safeParse({
            type: 'about:blank',
            title: 'Not Found',
            status: 404,
            detail: 'missing',
        });
        expect(result.success).toBe(true);
    });

    it('healthSchema validates ok status', () => {
        expect(healthSchema.safeParse({ status: 'ok' }).success).toBe(true);
        expect(healthSchema.safeParse({ status: 'bad' }).success).toBe(false);
    });

    it('readyErrorSchema validates error shape', () => {
        const result = readyErrorSchema.safeParse({
            type: 'about:blank',
            title: 'Service Unavailable',
            status: 503,
            detail: 'db down',
        });
        expect(result.success).toBe(true);
    });
});

describe('toJsonSchema', () => {
    it('returns a JSON schema object', () => {
        const schema = toJsonSchema(healthSchema);
        expect(schema).toHaveProperty('type', 'object');
        expect(schema).toHaveProperty('properties');
    });
});

describe('createProblemDetail', () => {
    it('creates an RFC 7807 problem detail', () => {
        const pd = createProblemDetail(404, 'Not Found', 'gone');
        expect(pd).toEqual({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'gone' });
    });
});
