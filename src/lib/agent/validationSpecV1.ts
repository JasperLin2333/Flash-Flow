export type ValidationSeverity = "hard" | "warning";

export interface ValidationIssueLocation {
  nodeId?: string;
  edgeId?: string;
  fieldPath?: string;
}

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  location?: ValidationIssueLocation;
  hint?: string;
}

export interface ValidationSpecItem {
  code: string;
  severity: ValidationSeverity;
  message: string;
  hint?: string;
  minimalRepro: {
    nodes: unknown;
    edges: unknown;
  };
}

export const HARD_ERROR_SPECS_V1_2: ValidationSpecItem[] = [
  {
    code: "FFV-SCHEMA-001",
    severity: "hard",
    message: "工作流缺少节点，无法执行。",
    minimalRepro: { nodes: [], edges: [] },
  },
  {
    code: "FFV-SCHEMA-002",
    severity: "hard",
    message: "工作流结构不合法（nodes/edges 必须是数组）。",
    minimalRepro: { nodes: {}, edges: null },
  },
  {
    code: "FFV-NODE-001",
    severity: "hard",
    message: "存在节点缺少 id 或 type，无法执行。",
    minimalRepro: { nodes: [{ type: "llm", data: {} }], edges: [] },
  },
  {
    code: "FFV-NODE-002",
    severity: "hard",
    message: "节点 id 重复会导致执行状态冲突，请修正。",
    minimalRepro: {
      nodes: [
        { id: "n1", type: "input", data: { label: "Input" } },
        { id: "n1", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
      ],
      edges: [],
    },
  },
  {
    code: "FFV-NODE-003",
    severity: "hard",
    message: "存在节点缺少 label，变量引用与展示将失效。",
    minimalRepro: {
      nodes: [
        { id: "n1", type: "input", data: {} },
        { id: "n2", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
      ],
      edges: [],
    },
  },
  {
    code: "FFV-NODE-004",
    severity: "hard",
    message: "存在重复的节点名称（label），会导致变量引用歧义。",
    minimalRepro: {
      nodes: [
        { id: "a", type: "input", data: { label: "User Input" } },
        { id: "b", type: "llm", data: { label: "user   input", model: "m", systemPrompt: "x", temperature: 0.7 } },
        { id: "c", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
      ],
      edges: [],
    },
  },
  {
    code: "FFV-NODE-005",
    severity: "hard",
    message: "节点名称（label）不应使用系统标识前缀（如 node_/edge_/auto_），否则变量引用与排障会极不稳定。",
    minimalRepro: {
      nodes: [
        { id: "i", type: "input", data: { label: "node_123" } },
        { id: "o", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
      ],
      edges: [],
    },
  },
  {
    code: "FFV-GRAPH-001",
    severity: "hard",
    message: "工作流缺少 Input 节点，无法接收用户输入。",
    minimalRepro: {
      nodes: [{ id: "o", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } }],
      edges: [],
    },
  },
  {
    code: "FFV-GRAPH-002",
    severity: "hard",
    message: "工作流缺少 Output 节点，无法输出结果。",
    minimalRepro: { nodes: [{ id: "i", type: "input", data: { label: "Input" } }], edges: [] },
  },
  {
    code: "FFV-EDGE-001",
    severity: "hard",
    message: "存在连线缺少 source/target，无法建立依赖关系。",
    minimalRepro: {
      nodes: [
        { id: "i", type: "input", data: { label: "Input" } },
        { id: "o", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
      ],
      edges: [{ source: "i" }],
    },
  },
  {
    code: "FFV-EDGE-002",
    severity: "hard",
    message: "存在连线指向不存在的节点，执行会失败。",
    minimalRepro: {
      nodes: [
        { id: "i", type: "input", data: { label: "Input" } },
        { id: "o", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
      ],
      edges: [{ id: "e1", source: "i", target: "missing" }],
    },
  },
  {
    code: "FFV-BRANCH-001",
    severity: "hard",
    message: "条件分支连线缺少 true/false 标记，分支无法路由。",
    minimalRepro: {
      nodes: [
        { id: "b", type: "branch", data: { label: "B", condition: "true" } },
        { id: "o", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
      ],
      edges: [{ id: "e1", source: "b", target: "o" }],
    },
  },
  {
    code: "FFV-BRANCH-002",
    severity: "hard",
    message: "普通节点连线不应包含 sourceHandle（仅分支允许）。",
    minimalRepro: {
      nodes: [
        { id: "i", type: "input", data: { label: "Input" } },
        { id: "o", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
      ],
      edges: [{ id: "e1", source: "i", target: "o", sourceHandle: "true" }],
    },
  },
  {
    code: "FFV-OUTPUT-001",
    severity: "hard",
    message: "Output 节点缺少输出配置（inputMappings.mode），无法渲染结果。",
    minimalRepro: {
      nodes: [
        { id: "i", type: "input", data: { label: "Input" } },
        { id: "o", type: "output", data: { label: "Output" } },
      ],
      edges: [],
    },
  },
  {
    code: "FFV-OUTPUT-002",
    severity: "hard",
    message: "Output 节点输出配置不完整（sources/template 缺失）。",
    minimalRepro: {
      nodes: [
        { id: "i", type: "input", data: { label: "Input" } },
        { id: "o", type: "output", data: { label: "Output", inputMappings: { mode: "template" } } },
      ],
      edges: [],
    },
  },
  {
    code: "FFV-LLM-001",
    severity: "hard",
    message: "LLM 节点配置不合法（temperature/responseFormat 等字段不符合约束）。",
    minimalRepro: {
      nodes: [
        { id: "i", type: "input", data: { label: "Input" } },
        { id: "l", type: "llm", data: { label: "LLM", temperature: 2 } },
        { id: "o", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
      ],
      edges: [],
    },
  },
  {
    code: "FFV-LLM-002",
    severity: "hard",
    message: "LLM 节点缺少 inputMappings.user_input，严格模式下将收到空输入。",
    minimalRepro: {
      nodes: [
        { id: "i", type: "input", data: { label: "Input" } },
        { id: "l", type: "llm", data: { label: "LLM", model: "m", systemPrompt: "", temperature: 0.7 } },
        { id: "o", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
      ],
      edges: [],
    },
  },
  {
    code: "FFV-TOOL-001",
    severity: "hard",
    message: "工具节点缺少工具类型（toolType），无法调用。",
    minimalRepro: {
      nodes: [
        { id: "t", type: "tool", data: { label: "Tool" } },
        { id: "o", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
      ],
      edges: [],
    },
  },
  {
    code: "FFV-RAG-001",
    severity: "hard",
    message: "知识库节点缺少检索配置（variable/static 任一模式必需字段不完整）。",
    minimalRepro: {
      nodes: [
        { id: "r", type: "rag", data: { label: "RAG" } },
        { id: "o", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
      ],
      edges: [],
    },
  },
  {
    code: "FFV-GRAPH-003",
    severity: "hard",
    message: "检测到循环依赖，工作流无法稳定执行。",
    minimalRepro: {
      nodes: [
        { id: "i", type: "input", data: { label: "Input" } },
        { id: "l", type: "llm", data: { label: "LLM", model: "m", systemPrompt: "x", temperature: 0.7 } },
        { id: "o", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
      ],
      edges: [
        { id: "e1", source: "i", target: "l" },
        { id: "e2", source: "l", target: "i" },
      ],
    },
  },
  {
    code: "FFV-BRANCH-003",
    severity: "hard",
    message: "检测到互斥分支汇聚到同一节点，可能导致节点永远不触发。",
    minimalRepro: {
      nodes: [
        { id: "b", type: "branch", data: { label: "B", condition: "true" } },
        { id: "l", type: "llm", data: { label: "LLM", model: "m", systemPrompt: "x", temperature: 0.7 } },
        { id: "o", type: "output", data: { label: "Output", inputMappings: { mode: "select", sources: [{ type: "variable", value: "{{LLM.response}}" }] } } },
      ],
      edges: [
        { id: "e1", source: "b", target: "l", sourceHandle: "true" },
        { id: "e2", source: "b", target: "l", sourceHandle: "false" },
        { id: "e3", source: "l", target: "o" },
      ],
    },
  },
  {
    code: "FFV-VAR-001",
    severity: "hard",
    message: "存在变量引用指向不存在的节点名称，执行时无法解析。",
    minimalRepro: {
      nodes: [
        { id: "l", type: "llm", data: { label: "LLM", model: "m", systemPrompt: "use {{Missing.response}}", temperature: 0.7 } },
        { id: "o", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
        { id: "i", type: "input", data: { label: "Input" } },
      ],
      edges: [],
    },
  },
  {
    code: "FFV-INPUT-001",
    severity: "hard",
    message: "Input 表单字段配置不合法（name 必须为英文变量名）。",
    minimalRepro: {
      nodes: [
        {
          id: "i",
          type: "input",
          data: {
            label: "Input",
            enableStructuredForm: true,
            formFields: [{ type: "text", name: "中文字段", label: "字段", required: false }],
          },
        },
        { id: "o", type: "output", data: { label: "Output", inputMappings: { mode: "direct", sources: [{ type: "static", value: "ok" }] } } },
      ],
      edges: [],
    },
  },
];
