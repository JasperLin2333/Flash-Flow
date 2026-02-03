import type { ToolType } from "@/lib/tools/registry";
import { executeWebSearch } from "./executors/webSearch";
import { executeCalculator } from "./executors/calculator";
import { executeDatetime } from "./executors/datetime";
import { executeUrlReader } from "./executors/urlReader";
import { executeCodeInterpreter } from "./executors/codeInterpreter";
import type { ToolExecutionResult } from "./types";

// Define a type for executor functions
// Note: We use a generic input type here because each executor has its own specific input type.
// Type safety is guaranteed by Zod schema validation in executeToolAction before calling executors.
type ToolExecutor = (inputs: any) => Promise<ToolExecutionResult>;

export const TOOL_EXECUTORS: Record<ToolType, ToolExecutor> = {
    web_search: executeWebSearch,
    calculator: executeCalculator,
    datetime: executeDatetime,
    url_reader: executeUrlReader,
    code_interpreter: executeCodeInterpreter,
};
