"use client";
import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class FlowErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Flow Error Boundary caught error:", error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center h-screen bg-white">
                    <div className="text-center max-w-md px-4">
                        <div className="flex justify-center mb-4">
                            <div className="p-4 bg-red-50 rounded-full border border-red-200">
                                <AlertTriangle className="w-8 h-8 text-red-600" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-gray-600 mb-6 text-sm">
                            {this.state.error?.message || "An unexpected error occurred in the flow editor."}
                        </p>
                        <Button
                            onClick={this.handleReset}
                            className="bg-black text-white hover:bg-black/90 active:bg-black/95 gap-2 font-semibold transition-colors duration-150"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reload Page
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
