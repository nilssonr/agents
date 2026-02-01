import { createClient } from '@agents/sdk';

/** Typed openapi-fetch client for the Agents Control Plane API. */
export const apiClient = createClient({ baseUrl: '/api' });
