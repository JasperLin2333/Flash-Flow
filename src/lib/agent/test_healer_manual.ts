
import { validateWorkflow } from "./utils";

// 构造一个包含多种错误的“毒”工作流
const toxicWorkflow = {
    nodes: [
        { id: "input_1", type: "input", data: { label: "用户代码输入" } },
        { id: "audit_node", type: "llm", data: { label: "代码审计专家", prompt: "审查代码: {{input_1.text}}" } }, // 变量引用使用的是 id (input_1) 而非 label
        { id: "fix_node", type: "llm", data: { label: "代码修复专家", prompt: "修复以下问题: {{CodeAudit.result}}" } }, // 变量引用错误：CodeAudit 不存在
        { id: "verify_node", type: "llm", data: { label: "修复验证", prompt: "检查修复: {{修复专家.text}}" } }, // label 引用错误：应该是 "代码修复专家"

        // 【孤岛节点】没有任何连线
        { id: "log_node", type: "tool", data: { label: "日志记录器" } },

        { id: "end_node", type: "output", data: { label: "最终输出" } }
    ],
    edges: [
        { source: "input_1", target: "audit_node" },
        { source: "audit_node", target: "fix_node" },
        { source: "fix_node", target: "verify_node" },

        // 【死循环】验证不通过回滚到修复 ( verify -> fix )
        { source: "verify_node", target: "fix_node" },

        { source: "verify_node", target: "end_node" }
    ]
};

console.log("🔥 开始测试三层自愈机制...");
console.log("----------------------------------------");
console.log("原始问题:");
console.log("1. [循环] verify_node -> fix_node -> verify_node");
console.log("2. [孤岛] log_node (日志记录器) 无连接");
console.log("3. [变量] input_1 (应为 {{用户代码输入}})");
console.log("4. [变量] CodeAudit (应为 {{代码审计专家}} - 基于模糊匹配)");
console.log("----------------------------------------");

// 运行验证与自愈
const result = validateWorkflow(toxicWorkflow.nodes, toxicWorkflow.edges);

console.log("\n✅ 验证结果:");
console.log(`IsValid: ${result.valid}`);
console.log(`SoftPass: ${result.softPass}`);

if (!result.valid && !result.softPass) {
    console.log("\n❌ 错误 (Errors):");
    result.errors.forEach(e => console.log(e));
}

console.log("\n🛠️ 自愈修正日志 (Warnings):");
result.warnings?.forEach((w, i) => console.log(`${i + 1}. ${w}`));

console.log("\n📦 修复后的边 (Fixed Edges):");
result.fixedEdges?.forEach(e => {
    console.log(`  ${e.source} -> ${e.target}`);
});
