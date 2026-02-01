/* eslint-disable @typescript-eslint/require-await */
import { describe, expect, it, vi } from 'vitest';

import { createActivityLogger } from './activity-logger.js';
import { createHttpRequestActivity, httpActivityParamsSchema } from './http-request-activity.js';

const logger = createActivityLogger();

function mockFetch(response: { status?: number; headers?: Record<string, string>; body?: unknown }): typeof fetch {
    const { status = 200, headers = {}, body = '' } = response;
    const isJson = typeof body === 'object';
    const responseHeaders = new Headers({
        ...headers,
        ...(isJson ? { 'content-type': 'application/json' } : {}),
    });

    const mockFn: typeof fetch = vi.fn<typeof fetch>().mockResolvedValue({
        status,
        ok: status >= 200 && status < 300,
        headers: responseHeaders,
        json: async () => body,
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    } as Response);
    return mockFn;
}

describe('httpActivityParamsSchema', () => {
    it('validates valid input', () => {
        const result = httpActivityParamsSchema.safeParse({
            method: { type: 'literal', value: 'GET' },
            url: { type: 'literal', value: 'https://example.com' },
        });
        expect(result.success).toBe(true);
    });

    it('rejects missing required fields', () => {
        const result = httpActivityParamsSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it('rejects bad method', () => {
        const result = httpActivityParamsSchema.safeParse({
            method: { type: 'literal', value: 'INVALID' },
            url: { type: 'literal', value: 'https://example.com' },
        });
        expect(result.success).toBe(false);
    });
});

describe('createHttpRequestActivity', () => {
    it('makes a GET request with literal values', async () => {
        const fetchFn = mockFetch({ status: 200, body: 'ok' });
        const activity = createHttpRequestActivity(fetchFn);

        const result = await activity(
            {
                method: { type: 'literal', value: 'GET' },
                url: { type: 'literal', value: 'https://example.com/api' },
            },
            null,
            {},
            logger,
        );

        expect(fetchFn).toHaveBeenCalledWith('https://example.com/api', expect.objectContaining({ method: 'GET' }));
        expect(result).toMatchObject({ status: 200, body: 'ok' });
    });

    it('resolves values from context', async () => {
        const fetchFn = mockFetch({ status: 200, body: 'ok' });
        const activity = createHttpRequestActivity(fetchFn);

        await activity(
            {
                method: { type: 'literal', value: 'POST' },
                url: { type: 'context', ref: 'endpoint' },
                body: { type: 'context', ref: 'data' },
            },
            null,
            { endpoint: 'https://example.com/submit', data: { key: 'value' } },
            logger,
        );

        expect(fetchFn).toHaveBeenCalledWith(
            'https://example.com/submit',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ key: 'value' }),
            }),
        );
    });

    it('auto-parses JSON response', async () => {
        const fetchFn = mockFetch({ status: 200, body: { result: 42 } });
        const activity = createHttpRequestActivity(fetchFn);

        const result = await activity(
            {
                method: { type: 'literal', value: 'GET' },
                url: { type: 'literal', value: 'https://example.com' },
            },
            null,
            {},
            logger,
        );

        expect(result).toMatchObject({ body: { result: 42 } });
    });

    it('auto-sets Content-Type for object bodies', async () => {
        const fetchFn = mockFetch({ status: 200, body: 'ok' });
        const activity = createHttpRequestActivity(fetchFn);

        await activity(
            {
                method: { type: 'literal', value: 'POST' },
                url: { type: 'literal', value: 'https://example.com' },
                body: { type: 'literal', value: { foo: 'bar' } },
            },
            null,
            {},
            logger,
        );

        expect(fetchFn).toHaveBeenCalledWith(
            'https://example.com',
            expect.objectContaining({
                headers: expect.objectContaining({ 'Content-Type': 'application/json' }) as Record<string, string>,
            }) as RequestInit,
        );
    });

    it('returns non-2xx responses without throwing', async () => {
        const fetchFn = mockFetch({ status: 404, body: 'not found' });
        const activity = createHttpRequestActivity(fetchFn);

        const result = await activity(
            {
                method: { type: 'literal', value: 'GET' },
                url: { type: 'literal', value: 'https://example.com/missing' },
            },
            null,
            {},
            logger,
        );

        expect(result).toMatchObject({ status: 404 });
    });

    it('throws on network error', async () => {
        const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Network error'));
        const activity = createHttpRequestActivity(fetchFn);

        await expect(
            activity(
                {
                    method: { type: 'literal', value: 'GET' },
                    url: { type: 'literal', value: 'https://example.com' },
                },
                null,
                {},
                logger,
            ),
        ).rejects.toThrow('Network error');
    });

    it('throws on timeout', async () => {
        const fetchFn = vi.fn<typeof fetch>().mockImplementation(
            (_url, init) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        reject(new DOMException('Aborted', 'AbortError'));
                    });
                }),
        );
        const activity = createHttpRequestActivity(fetchFn);

        await expect(
            activity(
                {
                    method: { type: 'literal', value: 'GET' },
                    url: { type: 'literal', value: 'https://example.com' },
                    timeout: { type: 'literal', value: 1 },
                },
                null,
                {},
                logger,
            ),
        ).rejects.toThrow();
    });
});
