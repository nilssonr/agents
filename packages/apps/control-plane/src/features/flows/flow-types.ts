/** A single step in a multi-step agent flow. */
export interface FlowStep {
    id: string;
    type: string;
    params?: unknown;
    maxRetries?: number | undefined;
    onError?: Record<string, string> | undefined;
}

/** Accumulated context passed between steps, keyed by step ID. */
export interface FlowContext {
    [stepId: string]: unknown;
}

/** Result of a successful step transition — either the next step ID or null (flow complete). */
export interface StepTransition {
    nextStepId: string | null;
    updatedContext: FlowContext;
}

/** Result of an error transition — retry same step, route to error step, or null (fail job). */
export interface ErrorTransition {
    nextStepId: string | null;
    retry: boolean;
}
