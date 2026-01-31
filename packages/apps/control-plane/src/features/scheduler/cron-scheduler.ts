import { Cron } from 'croner';

import { createLogger } from '@agents/logger';

import type { TriggerRepository } from '../triggers/trigger-repository.js';
import type { AgentService } from '../agents/agent-service.js';

const logger = createLogger('cron-scheduler');

export interface CronScheduler {
    start(): void;
    stop(): void;
}

export function createCronScheduler(
    triggerRepo: TriggerRepository,
    agentService: AgentService,
    intervalMs: number,
): CronScheduler {
    let timer: ReturnType<typeof setInterval> | null = null;
    const lastFired = new Map<string, number>();

    async function tick(): Promise<void> {
        try {
            const triggers = await triggerRepo.getCronTriggers();
            const now = Date.now();

            for (const trigger of triggers) {
                if (!trigger.cron_expression) continue;

                const cron = new Cron(trigger.cron_expression);
                const next = cron.nextRun();
                if (!next) continue;

                const nextMs = next.getTime();
                const last = lastFired.get(trigger.id) ?? 0;

                if (nextMs <= now + intervalMs && nextMs > last) {
                    lastFired.set(trigger.id, now);
                    logger.info({ agentId: trigger.agent_id, cron: trigger.cron_expression }, 'cron trigger fired');
                    await agentService.invokeAgent(trigger.agent_id, {
                        trigger: 'cron',
                        cron_expression: trigger.cron_expression,
                    });
                }
            }
        } catch (err: unknown) {
            logger.error({ err }, 'cron scheduler error');
        }
    }

    return {
        start(): void {
            timer = setInterval(() => {
                void tick();
            }, intervalMs);
            logger.info({ intervalMs }, 'cron scheduler started');
        },
        stop(): void {
            if (timer) {
                clearInterval(timer);
                timer = null;
                logger.info('cron scheduler stopped');
            }
        },
    };
}
