import { parseFlowSteps, findStepById } from './flow-parser.js';
import type { FlowStep, FlowContext, StepTransition, ErrorTransition } from './flow-types.js';

/** Orchestrates multi-step flow logic: initial step selection, success routing, and error handling. */
export interface FlowService {
    getInitialStep(activities: unknown): FlowStep | null;
    handleStepSuccess(
        activities: unknown,
        currentStepId: string,
        stepResult: unknown,
        currentContext: FlowContext,
    ): StepTransition;
    handleStepFailure(
        activities: unknown,
        currentStepId: string,
        error: { message: string; type?: string },
        currentRetries: number,
        currentContext: FlowContext,
    ): ErrorTransition;
}

/**
 * Creates a {@link FlowService} that determines step transitions for multi-step agent flows.
 *
 * Success routing checks for a `next` field in the step result. Error routing checks
 * retry limits and `onError` mappings before giving up.
 */
export function createFlowService(): FlowService {
    return {
        getInitialStep(activities: unknown): FlowStep | null {
            const steps = parseFlowSteps(activities);
            return steps.length > 0 ? steps[0] : null;
        },

        handleStepSuccess(
            activities: unknown,
            currentStepId: string,
            stepResult: unknown,
            currentContext: FlowContext,
        ): StepTransition {
            const steps = parseFlowSteps(activities);
            const updatedContext: FlowContext = {
                ...currentContext,
                [currentStepId]: stepResult,
            };

            // Check if the result specifies a next step
            const resultObj = stepResult as Record<string, unknown> | null;
            const nextId = resultObj && typeof resultObj.next === 'string' ? resultObj.next : null;

            if (nextId) {
                const nextStep = findStepById(steps, nextId);
                if (!nextStep) {
                    // Invalid next reference — treat as flow complete
                    return { nextStepId: null, updatedContext };
                }
                return { nextStepId: nextId, updatedContext };
            }

            // No next — flow is complete
            return { nextStepId: null, updatedContext };
        },

        handleStepFailure(
            activities: unknown,
            currentStepId: string,
            error: { message: string; type?: string },
            currentRetries: number,
            _currentContext: FlowContext,
        ): ErrorTransition {
            const steps = parseFlowSteps(activities);
            const step = findStepById(steps, currentStepId);

            if (!step) {
                return { nextStepId: null, retry: false };
            }

            // Check retries first
            if (step.maxRetries && currentRetries < step.maxRetries) {
                return { nextStepId: currentStepId, retry: true };
            }

            // Check onError routing
            if (step.onError) {
                // Try specific error type first
                if (error.type && step.onError[error.type]) {
                    const targetId = step.onError[error.type];
                    if (findStepById(steps, targetId)) {
                        return { nextStepId: targetId, retry: false };
                    }
                }
                // Try default
                if (step.onError.default) {
                    const targetId = step.onError.default;
                    if (findStepById(steps, targetId)) {
                        return { nextStepId: targetId, retry: false };
                    }
                }
            }

            // No recovery
            return { nextStepId: null, retry: false };
        },
    };
}
