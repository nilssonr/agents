import { rootRoute } from './routes/__root';
import { indexRoute } from './routes/index';
import { agentsIndexRoute } from './routes/agents/index';
import { agentDetailRoute } from './routes/agents/$agentId';
import { agentEditorRoute } from './routes/agents/$agentId.editor';
import { jobDetailRoute } from './routes/jobs/$jobId';

export const routeTree = rootRoute.addChildren([
    indexRoute,
    agentsIndexRoute,
    agentDetailRoute,
    agentEditorRoute,
    jobDetailRoute,
]);
