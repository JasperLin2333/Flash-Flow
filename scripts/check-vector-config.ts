import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CheckResult {
  name: string;
  status: "success" | "error" | "warning";
  message: string;
  details?: any;
}

const results: CheckResult[] = [];

async function check1_checkPgvectorExtension() {
  console.log("\n🔍 检查1: pgvector 扩展...");

  try {
    const { data, error } = await supabase.rpc("check_pgvector", { test_param: 1 });

    if (error) {
      results.push({
        name: "pgvector 扩展",
        status: "error",
        message: "无法直接检查，尝试间接验证...",
        details: error
      });
    } else {
      results.push({
        name: "pgvector 扩展",
        status: "success",
        message: "pgvector 扩展已启用",
      });
    }
  } catch (e) {
    results.push({
      name: "pgvector 扩展",
      status: "warning",
      message: "无法直接检查，将通过其他项目验证",
    });
  }
}

async function check2_checkAgentDocsTable() {
  console.log("🔍 检查2: agent_docs 表...");

  try {
    const { data, error } = await supabase
      .from("agent_docs")
      .select("count", { count: "exact", head: true });

    if (error) {
      results.push({
        name: "agent_docs 表",
        status: "error",
        message: `表不存在或无法访问: ${error.message}`,
        details: error
      });
    } else {
      const count = data?.[0]?.count || 0;
      results.push({
        name: "agent_docs 表",
        status: "success",
        message: `表存在，当前有 ${count} 个文档`,
        details: { count }
      });
    }
  } catch (e: any) {
    results.push({
      name: "agent_docs 表",
      status: "error",
      message: `检查失败: ${e.message}`,
      details: e
    });
  }
}

async function check3_checkVectorIndex() {
  console.log("🔍 检查3: 向量索引...");

  try {
    const { data, error } = await supabase.rpc("match_agent_docs", {
      query_embedding: new Array(1024).fill(0.1),
      match_threshold: 0,
      match_count: 1
    });

    if (error && error.code === "PGRST116") {
      results.push({
        name: "向量索引",
        status: "error",
        message: "match_agent_docs 函数不存在或索引未正确创建",
        details: error
      });
    } else if (error) {
      results.push({
        name: "向量索引",
        status: "warning",
        message: `可能存在问题: ${error.message}`,
        details: error
      });
    } else {
      results.push({
        name: "向量索引",
        status: "success",
        message: "向量搜索功能可用 (1024维)",
      });
    }
  } catch (e: any) {
    results.push({
      name: "向量索引",
      status: "error",
      message: `检查失败: ${e.message}`,
      details: e
    });
  }
}

async function check4_checkEmbeddingService() {
  console.log("🔍 检查4: SiliconFlow Embedding 服务...");

  if (!process.env.SILICONFLOW_API_KEY) {
    results.push({
      name: "SiliconFlow API Key",
      status: "error",
      message: "SILICONFLOW_API_KEY 未在 .env.local 中配置",
    });
    return;
  }

  const key = process.env.SILICONFLOW_API_KEY;
  if (key.length < 10 || !key.startsWith("sk-")) {
    results.push({
      name: "SiliconFlow API Key",
      status: "warning",
      message: "API Key 格式可能不正确（应以 sk- 开头）",
      details: { keyLength: key.length }
    });
  } else {
    results.push({
      name: "SiliconFlow Embedding 服务",
      status: "success",
      message: "API Key 已配置",
    });
  }
}

async function check5_testVectorSearch() {
  console.log("🔍 检查5: 测试向量搜索...");

  try {
    const response = await fetch("/api/agent/search-docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "test query",
        topK: 1
      }),
    });

    if (response.ok) {
      const data = await response.json();

      if (data.error) {
        results.push({
          name: "向量搜索 API",
          status: "warning",
          message: `API返回错误: ${data.error}`,
          details: data
        });
      } else {
        results.push({
          name: "向量搜索 API",
          status: "success",
          message: "API 正常工作",
          details: {
            returnedResults: data.count || 0,
            latency: data.latency
          }
        });
      }
    } else {
      results.push({
        name: "向量搜索 API",
        status: "error",
        message: `API 请求失败: ${response.status} ${response.statusText}`,
        details: { status: response.status }
      });
    }
  } catch (e: any) {
    results.push({
      name: "向量搜索 API",
      status: "warning",
      message: `无法测试（可能服务未启动）: ${e.message}`,
    });
  }
}

async function main() {
  console.log("🚀 开始检测向量数据库配置...\n");
  console.log("=".repeat(60));

  await check1_checkPgvectorExtension();
  await check2_checkAgentDocsTable();
  await check3_checkVectorIndex();
  await check4_checkEmbeddingService();
  await check5_testVectorSearch();

  console.log("\n" + "=".repeat(60));
  console.log("📊 检测结果汇总\n");

  const successCount = results.filter(r => r.status === "success").length;
  const errorCount = results.filter(r => r.status === "error").length;
  const warningCount = results.filter(r => r.status === "warning").length;

  results.forEach((result, index) => {
    const icon = result.status === "success" ? "✅" : result.status === "error" ? "❌" : "⚠️";
    console.log(`${icon} ${index + 1}. ${result.name}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   详情:`, JSON.stringify(result.details, null, 2));
    }
    console.log("");
  });

  console.log("=".repeat(60));
  console.log(`\n📈 统计:`);
  console.log(`   成功: ${successCount}/${results.length}`);
  console.log(`   错误: ${errorCount}/${results.length}`);
  console.log(`   警告: ${warningCount}/${results.length}`);

  if (errorCount === 0 && warningCount === 0) {
    console.log("\n🎉 恭喜！所有检查都通过了，配置完美！");
    console.log("\n🚀 下一步: 运行文档初始化脚本");
    console.log("   npx tsx scripts/init-agent-docs.ts");
  } else if (errorCount > 0) {
    console.log("\n⚠️ 发现错误，需要修复后才能继续。");
    console.log("\n请查看上面的错误详情并参考文档修复。");
  } else {
    console.log("\n✅ 配置基本正确，有一些警告但不影响使用。");
    console.log("\n🚀 可以尝试运行初始化脚本:");
    console.log("   npx tsx scripts/init-agent-docs.ts");
  }

  console.log("\n" + "=".repeat(60) + "\n");
}

main().catch(console.error);
