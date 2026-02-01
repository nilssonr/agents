import { useEffect, useState, useCallback } from 'react';

interface Toast {
    id: number;
    message: string;
    variant: 'success' | 'error';
}

let toastId = 0;
let addToastGlobal: ((message: string, variant: 'success' | 'error') => void) | null = null;

/** Imperatively show a toast notification. */
export function showToast(message: string, variant: 'success' | 'error' = 'success') {
    addToastGlobal?.(message, variant);
}

/** Renders toast notifications in the top-right corner. Mount once near the app root. */
export function ToastContainer() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, variant: 'success' | 'error') => {
        const id = ++toastId;
        setToasts((prev) => [...prev, { id, message, variant }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    useEffect(() => {
        addToastGlobal = addToast;
        return () => {
            addToastGlobal = null;
        };
    }, [addToast]);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`animate-in slide-in-from-right fade-in rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
                        toast.variant === 'success'
                            ? 'border border-green-200 bg-green-50 text-green-800'
                            : 'border border-red-200 bg-red-50 text-red-800'
                    }`}
                >
                    {toast.message}
                </div>
            ))}
        </div>
    );
}
