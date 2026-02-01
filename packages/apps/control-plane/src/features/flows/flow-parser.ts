import type { FlowStep } from './flow-types.js';

/**
 * Parses raw agent activities into validated {@link FlowStep} objects.
 *
 * Auto-generates IDs (`step_0`, `step_1`, …) for steps missing an `id` field.
 * Validates that all `onError` targets reference existing step IDs and that
 * every step has a `type`.
 */
export function parseFlowSteps(activities: unknown): FlowStep[] {
    if (!Array.isArray(activities) || activities.length === 0) {
        return [];
    }

    const steps: FlowStep[] = activities.map((activity: unknown, index: number) => {
        const a = activity as Record<string, unknown>;
        if (!a || typeof a !== 'object') {
            throw new Error(`Activity at index ${String(index)} is not an object`);
        }
        if (!a.type || typeof a.type !== 'string') {
            throw new Error(`Activity at index ${String(index)} is missing a 'type' field`);
        }
        return {
            id: typeof a.id === 'string' ? a.id : `step_${String(index)}`,
            type: a.type,
            params: a.params,
            maxRetries: typeof a.maxRetries === 'number' ? a.maxRetries : undefined,
            onError: a.onError && typeof a.onError === 'object'
                ? a.onError as Record<string, string>
                : undefined,
        };
    });

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const step of steps) {
        if (ids.has(step.id)) {
            throw new Error(`Duplicate step ID: ${step.id}`);
        }
        ids.add(step.id);
    }

    // Validate onError targets
    for (const step of steps) {
        if (step.onError) {
            for (const [key, targetId] of Object.entries(step.onError)) {
                if (!ids.has(targetId)) {
                    throw new Error(
                        `Step '${step.id}' onError['${key}'] references unknown step '${targetId}'`,
                    );
                }
            }
        }
    }

    return steps;
}

/** Finds a step by ID in a list of flow steps. */
export function findStepById(steps: FlowStep[], stepId: string): FlowStep | null {
    return steps.find((s) => s.id === stepId) ?? null;
}
