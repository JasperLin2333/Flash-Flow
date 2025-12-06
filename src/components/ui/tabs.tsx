/**
 * Tabs Component
 * Simple tabs implementation for UI
 */

"use client";

import * as React from "react";

interface TabsContextValue {
    value: string;
    onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

function useTabs() {
    const context = React.useContext(TabsContext);
    if (!context) {
        throw new Error("Tabs components must be used within a Tabs provider");
    }
    return context;
}

interface TabsProps {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
    className?: string;
}

export function Tabs({ value, onValueChange, children, className = "" }: TabsProps) {
    return (
        <TabsContext.Provider value={{ value, onValueChange }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    );
}

interface TabsListProps {
    children: React.ReactNode;
    className?: string;
}

export function TabsList({ children, className = "" }: TabsListProps) {
    return (
        <div className={`inline-flex h-10 items-center justify-center rounded-md bg-zinc-100 p-1 ${className}`}>
            {children}
        </div>
    );
}

interface TabsTriggerProps {
    value: string;
    children: React.ReactNode;
    className?: string;
}

export function TabsTrigger({ value: triggerValue, children, className = "" }: TabsTriggerProps) {
    const { value, onValueChange } = useTabs();
    const isActive = value === triggerValue;

    return (
        <button
            type="button"
            onClick={() => onValueChange(triggerValue)}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${isActive
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                } ${className}`}
        >
            {children}
        </button>
    );
}

interface TabsContentProps {
    value: string;
    children: React.ReactNode;
    className?: string;
}

export function TabsContent({ value: contentValue, children, className = "" }: TabsContentProps) {
    const { value } = useTabs();

    if (value !== contentValue) {
        return null;
    }

    return <div className={className}>{children}</div>;
}
