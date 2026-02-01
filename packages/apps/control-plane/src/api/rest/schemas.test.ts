import { describe, expect, it } from 'vitest';

import { createAgentSchema, invokeAgentSchema, jobsQuerySchema, validateBody } from './schemas.js';

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
