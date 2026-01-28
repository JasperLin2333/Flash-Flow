import { Button } from "@/components/ui/button";
import { X, Home, Plus } from "lucide-react";
import { AppIcon } from "./AppIcon";
import { LAYOUT, STYLES, BUTTON_STYLES, UI_TEXT, type FlowIconConfig } from "./constants";

interface HeaderProps {
    flowTitle: string;
    flowIcon?: FlowIconConfig;
    onClose?: () => void;
    onGoHome?: () => void;
    onNewConversation?: () => void;
}

/**
 * Header - 头部导航区
 * 显示应用标题、图标、关闭按钮
 */
export function Header({
    flowTitle,
    flowIcon,
    onClose,
    onGoHome,
    onNewConversation,
}: HeaderProps) {
    return (
        <header className={`${LAYOUT.headerHeight} ${LAYOUT.spacing.header} ${STYLES.header} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
                <AppIcon flowIcon={flowIcon} />
                <h1 className="font-bold text-sm text-gray-900">{flowTitle || UI_TEXT.appTitle}</h1>
                {onNewConversation && (
                    <button
                        onClick={onNewConversation}
                        className={BUTTON_STYLES.newConversation}
                        aria-label="开启新会话"
                    >
                        <Plus className="w-4 h-4 inline mr-1" />
                        开启新会话
                    </button>
                )}
            </div>
            <div className="flex items-center gap-2">
                {onGoHome && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onGoHome}
                        className="gap-1.5 text-gray-500 hover:text-gray-900"
                    >
                        <Home className="w-4 h-4" />
                        {UI_TEXT.homeButton}
                    </Button>
                )}
                {onClose && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        aria-label={UI_TEXT.closeButton}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                )}
            </div>
        </header>
    );
}
