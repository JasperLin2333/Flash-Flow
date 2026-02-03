/**
 * Feed Reducers - Agent 思维链事件处理函数
 * 
 * 从 agentCopilotActions.ts 拆分出来的纯函数，
 * 用于处理 SSE 事件并更新 FeedItem 数组。
 * 
 * ⚠️ 重要：所有函数使用不可变更新模式，不直接修改原数组元素
 */

import type { FeedItem, ThoughtItem, ToolCallItem, SuggestionItem, StepItem, ClarificationItem, PlanItem } from '@/types/flow';

/**
 * 生成唯一的 FeedItem ID
 * 使用 crypto.randomUUID() 替代 Date.now() + Math.random()
 */
export function generateFeedItemId(prefix: string): string {
    // Edge/Browser 环境下使用 crypto.randomUUID()
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
    }
    // 降级方案
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 处理 thinking-start 事件
 * 创建新的 ThoughtItem（如果当前没有进行中的思考）
 */
export function handleThinkingStart(feed: FeedItem[]): FeedItem[] {
    const lastItem = feed[feed.length - 1];

    // 如果最后一项不是未完成的思考，则创建新的
    if (!lastItem || lastItem.type !== 'thought' || (lastItem as ThoughtItem).isComplete) {
        return [
            ...feed,
            {
                id: generateFeedItemId('thought'),
                type: 'thought',
                content: '',
                isComplete: false,
                timestamp: Date.now()
            } as ThoughtItem
        ];
    }

    // 已有进行中的思考，无需更改
    return feed;
}

/**
 * 处理 thinking 事件
 * 追加思考内容到当前 ThoughtItem，或创建新的
 * ⚠️ 使用 map 创建新对象，避免直接突变
 */
export function handleThinking(feed: FeedItem[], content: string): FeedItem[] {
    const lastItem = feed[feed.length - 1];

    if (lastItem && lastItem.type === 'thought' && !(lastItem as ThoughtItem).isComplete) {
        // 使用 map 创建新数组，最后一个元素创建新对象
        return feed.map((item, index) =>
            index === feed.length - 1
                ? { ...item, content: (item as ThoughtItem).content + content }
                : item
        );
    }

    // 创建新的思考项
    return [
        ...feed,
        {
            id: generateFeedItemId('thought'),
            type: 'thought',
            content: content,
            isComplete: false,
            timestamp: Date.now()
        } as ThoughtItem
    ];
}

/**
 * 处理 thinking-end 事件
 * 标记当前 ThoughtItem 为已完成
 * ⚠️ 使用 map 创建新对象，避免直接突变
 */
export function handleThinkingEnd(feed: FeedItem[]): FeedItem[] {
    const lastItem = feed[feed.length - 1];

    if (lastItem && lastItem.type === 'thought' && !(lastItem as ThoughtItem).isComplete) {
        return feed.map((item, index) =>
            index === feed.length - 1
                ? { ...item, isComplete: true }
                : item
        );
    }

    return feed;
}

/**
 * 处理 tool-call 事件
 * 创建新的 ToolCallItem，同时标记进行中的思考为完成
 * ⚠️ 使用 map 创建新对象，避免直接突变
 */
export function handleToolCall(feed: FeedItem[], tool: string): FeedItem[] {
    const lastItem = feed[feed.length - 1];

    // 如果有进行中的思考，先标记为完成（使用不可变更新）
    const updatedFeed = (lastItem && lastItem.type === 'thought' && !(lastItem as ThoughtItem).isComplete)
        ? feed.map((item, index) =>
            index === feed.length - 1
                ? { ...item, isComplete: true }
                : item
        )
        : feed;

    // 创建新的工具调用项
    return [
        ...updatedFeed,
        {
            id: generateFeedItemId(tool),
            type: 'tool-call',
            tool: tool,
            status: 'calling',
            timestamp: Date.now()
        } as ToolCallItem
    ];
}

/**
 * 处理 tool-result 事件
 * 更新最后一个匹配的 ToolCallItem 状态
 * ⚠️ 使用 map 创建新对象，避免直接突变
 */
export function handleToolResult(feed: FeedItem[], tool: string, result: unknown): FeedItem[] {
    // 反向查找最后一个 'calling' 状态的工具调用索引
    let targetIndex = -1;
    for (let i = feed.length - 1; i >= 0; i--) {
        const item = feed[i];
        if (item.type === 'tool-call' && (item as ToolCallItem).tool === tool && (item as ToolCallItem).status === 'calling') {
            targetIndex = i;
            break;
        }
    }

    if (targetIndex === -1) {
        return feed; // 未找到匹配项
    }

    // 使用 map 创建新数组，目标元素创建新对象
    return feed.map((item, index) =>
        index === targetIndex
            ? { ...item, status: 'completed', result } as ToolCallItem
            : item
    );
}

/**
 * 处理 suggestion 事件
 * 创建新的 SuggestionItem
 */
export function handleSuggestion(feed: FeedItem[], content: string, scenario?: string): FeedItem[] {
    return [
        ...feed,
        {
            id: generateFeedItemId('sugg'),
            type: 'suggestion',
            content: content,
            scenario: scenario,
            timestamp: Date.now()
        } as SuggestionItem
    ];
}

/**
 * 处理 step 事件 (Structured Thinking)
 * 更新已存在的 StepItem 或创建新的
 */
export function handleStep(feed: FeedItem[], stepType: string, status: 'streaming' | 'completed' | 'error', content: string, forceUpdate = false): FeedItem[] {
    // 1. Auto-complete any PREVIOUS streaming steps if this is a NEW step type
    // This ensures that when we move from "Analysis" -> "Strategy", the "Analysis" loading stops.
    let updatedFeed = feed;
    
    // Only perform this check if we are NOT updating an existing step of the same type
    const isUpdatingSameType = feed.some(item => 
        item.type === 'step' && 
        (item as StepItem).stepType === stepType && 
        (item as StepItem).status !== 'completed' && 
        (item as StepItem).status !== 'error'
    );

    if (!isUpdatingSameType && !forceUpdate) {
        updatedFeed = feed.map(item => {
            if (
                item.type === 'step' &&
                (item as StepItem).status === 'streaming' &&
                (item as StepItem).stepType !== 'plan_confirm' &&
                (item as StepItem).stepType !== 'plan_adjust'
            ) {
                return { ...item, status: 'completed' } as StepItem;
            }
            return item;
        });
    }

    // Generic reverse search for existing step
    // FIX for Infinite Loading: We must strictly match type AND ensure we don't accidentally update a completed historic step
    // unless forceUpdate is explicit.
    // For adjustments, we want to find the 'streaming' placeholder created by agentCopilotActions
    let targetIndex = -1;
    for (let i = updatedFeed.length - 1; i >= 0; i--) {
        const item = updatedFeed[i];
        if (item.type === 'step' && (item as StepItem).stepType === stepType) {
            // Found a match. Is it the active one?
            if (forceUpdate || (item as StepItem).status !== 'completed' && (item as StepItem).status !== 'error') {
                targetIndex = i;
                break;
            }
            // If we found a completed one, stop searching if we are not forcing update?
            // No, because we might have [Completed Analysis] ... [Pending Analysis]
        }
    }

    if (targetIndex !== -1) {
        return updatedFeed.map((item, index) => {
            if (index === targetIndex) {
                const existingItem = item as StepItem;
                // Append content for streaming updates, or if the new content is empty (e.g. completion event)
                const newContent = (status === 'streaming' || !content) 
                    ? existingItem.content + content 
                    : content;
                
                return { ...item, status, content: newContent } as StepItem;
            }
            return item;
        });
    }

    // Create new item (either first time or retry)
    const newItem: StepItem = {
        id: generateFeedItemId(stepType),
        type: 'step',
        stepType,
        status,
        content,
        timestamp: Date.now()
    };

    return [...updatedFeed, newItem];
}

/**
 * Handle clarification event
 * Create new ClarificationItem
 */
export function handleClarification(feed: FeedItem[], questions: string[]): FeedItem[] {
    return [
        ...feed,
        {
            id: generateFeedItemId('clarification'),
            type: 'clarification',
            questions: questions,
            timestamp: Date.now()
        } as ClarificationItem
    ];
}

/**
 * Handle plan event
 * Create new PlanItem for user review
 */
export function handlePlan(
    feed: FeedItem[],
    userPrompt: string,
    steps: string[],
    extras?: {
        refinedIntent?: string;
        workflowNodes?: { type: string; label: string; description: string }[];
        useCases?: string[];
        howToUse?: string[];
    }
): FeedItem[] {
    return [
        ...feed,
        {
            id: generateFeedItemId('plan'),
            type: 'plan',
            userPrompt,
            steps,
            status: 'awaiting_confirm',
            timestamp: Date.now(),
            // Include new structured fields
            refinedIntent: extras?.refinedIntent,
            workflowNodes: extras?.workflowNodes,
            useCases: extras?.useCases,
            howToUse: extras?.howToUse
        } as PlanItem
    ];
}

/**
 * Update plan status
 */
export function updatePlanStatus(feed: FeedItem[], status: 'awaiting_confirm' | 'confirmed' | 'adjusting'): FeedItem[] {
    // Find the last plan item
    let planIndex = -1;
    for (let i = feed.length - 1; i >= 0; i--) {
        if (feed[i].type === 'plan') {
            planIndex = i;
            break;
        }
    }

    if (planIndex === -1) return feed;

    return feed.map((item, index) =>
        index === planIndex
            ? { ...item, status } as PlanItem
            : item
    );
}
