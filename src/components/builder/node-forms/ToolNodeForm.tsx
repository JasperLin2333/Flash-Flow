"use client";

import { useWatch } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { TOOL_REGISTRY, getAllToolIds, getToolConfig, DEFAULT_TOOL_TYPE, type ToolType, DATETIME_OPERATIONS, TIME_UNIT_OPTIONS } from "@/lib/tools/registry";
import { NODE_FORM_STYLES, type BaseNodeFormProps, CapabilityItem } from "./shared";
import { Wrench, Terminal, Calculator, Calendar, Globe, Search } from "lucide-react";

const STYLES = NODE_FORM_STYLES;

// ============ Individual Tool Forms ============

const WebSearchForm = ({ form }: { form: any }) => (
    <div className="space-y-4 pt-2">
        <FormField
            control={form.control}
            name="query"
            render={({ field }) => (
                <FormItem>
                    <FormLabel className={STYLES.LABEL}>搜索关键词 (Query)</FormLabel>
                    <FormControl>
                        <div className={STYLES.EDITOR_WRAPPER}>
                            <div className={STYLES.EDITOR_HEADER}>
                                <div className={STYLES.EDITOR_LABEL}>
                                    <Search className="w-3 h-3" />
                                    Search Query
                                </div>
                            </div>
                            <Textarea 
                                {...field} 
                                className={STYLES.EDITOR_AREA} 
                                placeholder="输入你想搜索的内容..."
                                rows={3}
                            />
                        </div>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
        
        <FormField
            control={form.control}
            name="maxResults"
            render={({ field }) => (
                <FormItem>
                    <div className="flex justify-between items-center mb-2">
                        <FormLabel className={`${STYLES.LABEL} mb-0`}>最大结果数</FormLabel>
                        <span className={STYLES.SLIDER_VALUE}>{field.value || 5}</span>
                    </div>
                    <FormControl>
                        <Slider
                            min={1}
                            max={10}
                            step={1}
                            value={[field.value || 5]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="py-1"
                        />
                    </FormControl>
                    <div className={STYLES.SLIDER_RANGE}>
                        <span>1</span>
                        <span>10</span>
                    </div>
                    <FormMessage />
                </FormItem>
            )}
        />
    </div>
);

const CalculatorForm = ({ form }: { form: any }) => (
    <div className="space-y-4 pt-2">
        <FormField
            control={form.control}
            name="expression"
            render={({ field }) => (
                <FormItem>
                    <FormLabel className={STYLES.LABEL}>数学表达式</FormLabel>
                    <FormControl>
                        <div className={STYLES.EDITOR_WRAPPER}>
                            <div className={STYLES.EDITOR_HEADER}>
                                <div className={STYLES.EDITOR_LABEL}>
                                    <Calculator className="w-3 h-3" />
                                    Expression
                                </div>
                            </div>
                            <Textarea 
                                {...field} 
                                className={`${STYLES.EDITOR_AREA} font-mono`}
                                placeholder="e.g. (12 + 5) * 3 / 2"
                                rows={3}
                            />
                        </div>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    </div>
);

const DatetimeForm = ({ form }: { form: any }) => {
    const operation = useWatch({ control: form.control, name: "operation" }) || "now";
    
    return (
        <div className="space-y-4 pt-2">
            <FormField
                control={form.control}
                name="operation"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className={STYLES.LABEL}>操作类型</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "now"}>
                            <FormControl>
                                <SelectTrigger className={STYLES.INPUT}>
                                    <SelectValue placeholder="选择操作" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {DATETIME_OPERATIONS.map(op => (
                                    <SelectItem key={op.value} value={op.value} className="text-xs">
                                        {op.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* Dynamic fields based on operation */}
            {(operation === "format" || operation === "diff" || operation === "add") && (
                <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className={STYLES.LABEL}>基础日期 (Date)</FormLabel>
                            <FormControl>
                                <Input {...field} className={STYLES.INPUT} placeholder="YYYY-MM-DD..." />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            {operation === "diff" && (
                <FormField
                    control={form.control}
                    name="targetDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className={STYLES.LABEL}>目标日期 (Target Date)</FormLabel>
                            <FormControl>
                                <Input {...field} className={STYLES.INPUT} placeholder="YYYY-MM-DD..." />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            {operation === "add" && (
                <div className="grid grid-cols-2 gap-3">
                    <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={STYLES.LABEL}>数量 (Amount)</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} className={STYLES.INPUT} placeholder="0" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="unit"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={STYLES.LABEL}>单位 (Unit)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || "day"}>
                                    <FormControl>
                                        <SelectTrigger className={STYLES.INPUT}>
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {TIME_UNIT_OPTIONS.map(u => (
                                            <SelectItem key={u.value} value={u.value} className="text-xs">{u.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            )}

            {(operation === "now" || operation === "format" || operation === "add") && (
                <FormField
                    control={form.control}
                    name="format"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className={STYLES.LABEL}>输出格式 (Format)</FormLabel>
                            <FormControl>
                                <Input {...field} className={STYLES.INPUT} placeholder="YYYY-MM-DD HH:mm:ss" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}
        </div>
    );
};

const UrlReaderForm = ({ form }: { form: any }) => (
    <div className="space-y-4 pt-2">
        <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
                <FormItem>
                    <FormLabel className={STYLES.LABEL}>目标链接 (URL)</FormLabel>
                    <FormControl>
                        <Input {...field} className={STYLES.INPUT} placeholder="https://example.com/article" />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
        <FormField
            control={form.control}
            name="maxLength"
            render={({ field }) => (
                <FormItem>
                    <FormLabel className={STYLES.LABEL}>最大抓取长度</FormLabel>
                    <FormControl>
                        <Input type="number" {...field} className={STYLES.INPUT} placeholder="5000" />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    </div>
);

const CodeInterpreterForm = ({ form }: { form: any }) => (
    <div className="space-y-4 pt-2">
        <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
                <FormItem>
                    <FormControl>
                        <div className={STYLES.EDITOR_WRAPPER}>
                            <div className={STYLES.EDITOR_HEADER}>
                                <div className={STYLES.EDITOR_LABEL}>
                                    <Terminal className="w-3 h-3" />
                                    Python Code
                                </div>
                            </div>
                            <Textarea 
                                {...field} 
                                className={`${STYLES.EDITOR_AREA} font-mono min-h-[200px]`}
                                placeholder={"print('Hello World')\n# Write your python code here"}
                                spellCheck={false}
                            />
                        </div>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
        
        <FormField
            control={form.control}
            name="outputFileName"
            render={({ field }) => (
                <FormItem>
                    <FormLabel className={STYLES.LABEL}>输出文件名 (可选)</FormLabel>
                    <FormControl>
                        <Input {...field} className={STYLES.INPUT} placeholder="result.csv" />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    </div>
);

const DefaultToolForm = () => (
    <div className="text-xs text-gray-400 p-2">此工具暂无额外配置</div>
);

// ============ Main Renderer ============

/**
 * 动态渲染工具参数组件
 * Refactored to separate components to avoid conditional hook usage
 */
const ToolParamsRenderer = ({ toolType, form }: { toolType: ToolType, form: any }) => {
    switch (toolType) {
        case "web_search": return <WebSearchForm form={form} />;
        case "calculator": return <CalculatorForm form={form} />;
        case "datetime": return <DatetimeForm form={form} />;
        case "url_reader": return <UrlReaderForm form={form} />;
        case "code_interpreter": return <CodeInterpreterForm form={form} />;
        default: return <DefaultToolForm />;
    }
};

/**
 * 映射工具图标
 */
const ToolIcon = ({ type }: { type: ToolType }) => {
    switch (type) {
        case "web_search": return <Search className="w-4 h-4" />;
        case "calculator": return <Calculator className="w-4 h-4" />;
        case "datetime": return <Calendar className="w-4 h-4" />;
        case "url_reader": return <Globe className="w-4 h-4" />;
        case "code_interpreter": return <Terminal className="w-4 h-4" />;
        default: return <Wrench className="w-4 h-4" />;
    }
};

const getToolColorClass = (type: ToolType) => {
    switch (type) {
        case "web_search": return "bg-blue-50 text-blue-600";
        case "calculator": return "bg-orange-50 text-orange-600";
        case "datetime": return "bg-green-50 text-green-600";
        case "url_reader": return "bg-indigo-50 text-indigo-600";
        case "code_interpreter": return "bg-gray-100 text-gray-700";
        default: return "bg-gray-50 text-gray-600";
    }
};

export function ToolNodeForm({ form }: BaseNodeFormProps) {
    const watchedToolType = useWatch({ control: form.control, name: "toolType" }) as ToolType | undefined;
    const toolType: ToolType = (watchedToolType && watchedToolType in TOOL_REGISTRY) ? watchedToolType : DEFAULT_TOOL_TYPE;
    const toolConfig = TOOL_REGISTRY[toolType];

    return (
        <div className="space-y-4 px-1 pb-4">
            {/* 1. Base Info - Frameless */}
            <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className={STYLES.LABEL}>节点名称</FormLabel>
                        <FormControl>
                            <Input {...field} className={STYLES.INPUT} placeholder="扩展能力节点" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className={STYLES.SECTION_DIVIDER} />

            {/* 2. Tool Selection */}
            <div className="space-y-2">
                <div className={STYLES.SECTION_TITLE}>扩展能力选择</div>
                <FormField
                    control={form.control}
                    name="toolType"
                    render={({ field }) => (
                        <FormItem>
                            <Select
                                key={field.value}
                                onValueChange={field.onChange}
                                value={field.value || DEFAULT_TOOL_TYPE}
                            >
                                <FormControl>
                                    <SelectTrigger className={STYLES.INPUT}>
                                        <SelectValue placeholder="选择扩展能力" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {getAllToolIds().map((id) => {
                                        const config = getToolConfig(id);
                                        return (
                                            <SelectItem key={id} value={id} className="cursor-pointer text-xs">
                                                <div className="flex items-center gap-2">
                                                    {config?.name || id}
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                            {toolConfig && (
                                <FormDescription className="text-[10px] text-gray-400 mt-1">
                                    {toolConfig.description}
                                </FormDescription>
                            )}
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            {/* 3. Tool Parameters - Dynamic & Wrapped */}
            {toolConfig && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className={STYLES.SECTION_TITLE}>能力参数设置</div>
                    
                    <CapabilityItem
                        icon={<ToolIcon type={toolType} />}
                        iconColorClass={getToolColorClass(toolType)}
                        title={toolConfig.name}
                        description={`${toolConfig.category} 能力参数配置`}
                        isExpanded={true}
                    >
                        <div className="px-1 pb-2">
                            <ToolParamsRenderer toolType={toolType} form={form} />
                        </div>
                    </CapabilityItem>
                </div>
            )}
        </div>
    );
}
