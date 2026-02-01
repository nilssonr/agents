import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface InvokePanelProps {
    onInvoke: (payload: unknown) => void;
    onClose: () => void;
    invoking?: boolean;
}

/** Side panel for invoking an agent with a JSON payload. */
export function InvokePanel({ onInvoke, onClose, invoking }: InvokePanelProps) {
    const [payload, setPayload] = useState('{}');

    function handleInvoke() {
        try {
            const parsed = JSON.parse(payload);
            onInvoke(parsed);
        } catch {
            // Invalid JSON — ignore
        }
    }

    return (
        <div className="w-64 shrink-0 border-l bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Invoke</h3>
                <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">
                    Close
                </button>
            </div>
            <div className="space-y-3">
                <div>
                    <label className="text-xs font-medium text-gray-500">Payload (JSON)</label>
                    <Textarea
                        className="mt-1 font-mono text-xs"
                        rows={8}
                        value={payload}
                        onChange={(e) => setPayload(e.target.value)}
                        placeholder="{}"
                    />
                </div>
                <Button size="sm" onClick={handleInvoke} disabled={invoking}>
                    {invoking ? 'Invoking...' : 'Invoke'}
                </Button>
            </div>
        </div>
    );
}
