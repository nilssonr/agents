import { z } from 'zod';

import type { ActivityLogger } from './activity-logger.js';
import type { ActivityFn } from './activity-types.js';
import { resolveValue, valueSourceSchema, type ValueSource } from './value-source.js';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;

/** Zod schema for HTTP request activity parameters. */
export const httpActivityParamsSchema = z.object({
    method: valueSourceSchema(z.enum(HTTP_METHODS)),
    url: valueSourceSchema(z.string()),
    headers: valueSourceSchema(z.record(z.string())).optional(),
    body: valueSourceSchema(z.unknown()).optional(),
    timeout: valueSourceSchema(z.number()).optional(),
});

export type HttpActivityParams = z.infer<typeof httpActivityParamsSchema>;

/** Result returned by the HTTP request activity. */
export interface HttpActivityResult {
    status: number;
    headers: Record<string, string>;
    body: unknown;
}

/**
 * Creates an activity that performs an HTTP request.
 *
 * - Validates params with Zod.
 * - Resolves all {@link ValueSource} fields from flow context.
 * - Auto-serializes object bodies as JSON and sets Content-Type when not specified.
 * - Auto-parses JSON responses based on Content-Type.
 * - Returns `{ status, headers, body, ok }` — never throws on HTTP status codes, only on network/timeout errors.
 *
 * @param fetchFn - Optional fetch implementation for testability (defaults to global `fetch`).
 */
export function createHttpRequestActivity(fetchFn: typeof fetch = fetch): ActivityFn {
    return async (
        _params: unknown,
        _payload: unknown,
        context: unknown,
        _logger: ActivityLogger,
    ): Promise<HttpActivityResult> => {
        const parsed = httpActivityParamsSchema.parse(_params);

        const method = resolveValue(parsed.method, context) as string;
        const url = resolveValue(parsed.url, context);
        const headers: Record<string, string> = parsed.headers
            ? resolveValue(parsed.headers as ValueSource<Record<string, string>>, context)
            : {};
        const rawBody = parsed.body ? resolveValue(parsed.body as ValueSource<unknown>, context) : undefined;
        const timeout = parsed.timeout ? resolveValue(parsed.timeout as ValueSource<number>, context) : 30_000;

        let requestBody: string | undefined;
        if (rawBody !== undefined) {
            if (typeof rawBody === 'object' && rawBody !== null) {
                requestBody = JSON.stringify(rawBody);
                if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
                    headers['Content-Type'] = 'application/json';
                }
            } else {
                requestBody = rawBody as string;
            }
        }

        const controller = new AbortController();
        const timer = setTimeout(() => {
            controller.abort();
        }, timeout);

        try {
            const init: RequestInit = { method, headers, signal: controller.signal };
            if (requestBody !== undefined) {
                init.body = requestBody;
            }
            const response = await fetchFn(url, init);

            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            const contentType = response.headers.get('content-type') ?? '';
            const body = contentType.includes('application/json') ? await response.json() : await response.text();

            return { status: response.status, headers: responseHeaders, body };
        } finally {
            clearTimeout(timer);
        }
    };
}
