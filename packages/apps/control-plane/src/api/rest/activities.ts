import type { FastifyInstance } from 'fastify';

/** Built-in activity type definitions with their parameter schemas. */
const ACTIVITY_DEFINITIONS = [
    {
        type: 'noop',
        description: 'Does nothing. Useful for testing.',
        params: {},
        defaultParams: {},
    },
    {
        type: 'http-request',
        description: 'Makes an HTTP request.',
        params: {
            url: { type: 'ValueSource<string>', required: true },
            method: { type: 'ValueSource<string>', required: false },
            headers: { type: 'ValueSource<object>', required: false },
            body: { type: 'ValueSource<unknown>', required: false },
        },
        defaultParams: { url: 'https://example.com', method: 'GET' },
    },
    {
        type: 'log',
        description: 'Emits a log entry.',
        params: {
            message: { type: 'ValueSource<string>', required: true },
            level: { type: 'ValueSource<"info" | "warn" | "error">', required: false },
        },
        defaultParams: { message: 'Hello, world!' },
    },
];

/**
 * Registers the `GET /activities` route returning available activity type definitions.
 */
export function registerActivityRoutes(app: FastifyInstance): void {
    app.get(
        '/activities',
        {
            schema: {
                tags: ['Activities'],
                description: 'List available activity types with their parameter schemas',
                response: {
                    200: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                type: { type: 'string' },
                                description: { type: 'string' },
                                params: { type: 'object', additionalProperties: true },
                                defaultParams: { type: 'object', additionalProperties: true },
                            },
                        },
                    },
                },
            },
        },
        /* eslint-disable-next-line @typescript-eslint/require-await */
        async () => {
            return ACTIVITY_DEFINITIONS;
        },
    );
}
