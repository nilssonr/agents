import createOpenApiClient from 'openapi-fetch';

import type { paths } from './generated/api.js';

/** Options for creating an SDK client. */
export interface CreateClientOptions {
    /** Base URL of the control-plane REST API. */
    baseUrl: string;
}

/** Creates a typed openapi-fetch client for the Agents Control Plane API. */
export function createClient(options: CreateClientOptions): ReturnType<typeof createOpenApiClient<paths>> {
    return createOpenApiClient<paths>({ baseUrl: options.baseUrl });
}
