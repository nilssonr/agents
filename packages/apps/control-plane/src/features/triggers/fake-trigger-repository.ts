import { randomUUID } from 'node:crypto';

import type { TriggerRepository, TriggerRow } from './trigger-repository.js';

export function createFakeTriggerRepository(): TriggerRepository & { triggers: TriggerRow[] } {
    const triggers: TriggerRow[] = [];

    return {
        triggers,
        async create(agentId, kind, cronExpression): Promise<TriggerRow> {
            const trigger: TriggerRow = {
                id: randomUUID(),
                agent_id: agentId,
                kind,
                cron_expression: cronExpression,
                created_at: new Date(),
            };
            triggers.push(trigger);
            return trigger;
        },
        async getByAgent(agentId): Promise<TriggerRow[]> {
            return triggers.filter((t) => t.agent_id === agentId);
        },
        async getCronTriggers(): Promise<Array<TriggerRow & { agent_status: string }>> {
            return triggers
                .filter((t) => t.kind === 'cron')
                .map((t) => ({ ...t, agent_status: 'active' }));
        },
        async delete(id): Promise<void> {
            const idx = triggers.findIndex((t) => t.id === id);
            if (idx !== -1) triggers.splice(idx, 1);
        },
    };
}
