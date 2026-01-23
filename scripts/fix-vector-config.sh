#!/bin/bash

# 向量数据库配置助手脚本

echo "🔧 向量数据库配置修复工具"
echo "=".repeat(50)
echo ""

# 检查OPENAI_API_KEY是否已配置
if grep -q "^OPENAI_API_KEY=" .env.local 2>/dev/null; then
    echo "✅ OPENAI_API_KEY 已配置"
    echo ""
    echo "当前配置值:"
    grep "^OPENAI_API_KEY=" .env.local | sed 's/OPENAI_API_KEY=//' | cut -c1-20
    echo "   (已截断，实际完整) "
else
    echo "❌ OPENAI_API_KEY 未配置"
    echo ""
    echo "🔧 正在添加 OPENAI_API_KEY 配置..."
    echo ""
    
    # 询问用户
    echo "请输入你的 OpenAI API Key:"
    echo "获取地址: https://platform.openai.com/api-keys"
    echo ""
    read -p "API Key: " api_key
    
    if [ -z "$api_key" ]; then
        echo "❌ API Key 不能为空"
        exit 1
    fi
    
    # 添加到.env.local
    echo "" >> .env.local
    echo "# OpenAI API (用于向量 Embedding)" >> .env.local
    echo "OPENAI_API_KEY=$api_key" >> .env.local
    
    echo ""
    echo "✅ OPENAI_API_KEY 已添加到 .env.local"
fi

echo ""
echo "=".repeat(50)
echo ""
echo "🚀 下一步: 运行文档初始化"
echo ""
echo "   npx tsx scripts/init-agent-docs.ts"
echo ""
echo "然后启动开发服务器:"
echo ""
echo "   npm run dev"
echo ""
