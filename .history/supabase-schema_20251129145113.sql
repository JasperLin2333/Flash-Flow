-- Flash Flow - Supabase 数据库表结构
-- 此文件包含应用所需的所有表结构定义
-- 已根据你的现有数据库结构进行校准

-- ============================================
-- Table: flows
-- 描述：存储所有工作流的基本信息
-- ============================================
CREATE TABLE IF NOT EXISTS flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    owner_id TEXT NOT NULL, -- 修正：使用 owner_id 匹配你的数据库
    icon_kind TEXT DEFAULT 'emoji',
    icon_name TEXT,
    icon_url TEXT,
    node_count INTEGER, -- 修正：添加 node_count 匹配你的数据库
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为 flows 表创建索引
CREATE INDEX IF NOT EXISTS idx_flows_owner_id ON flows(owner_id);
CREATE INDEX IF NOT EXISTS idx_flows_created_at ON flows(created_at DESC);

-- ============================================
-- Table: chat_history
-- 描述：存储每个 flow 的聊天历史记录
-- ============================================
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    user_message TEXT NOT NULL,
    assistant_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为 chat_history 表创建索引
CREATE INDEX IF NOT EXISTS idx_chat_history_flow_id ON chat_history(flow_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at DESC);

-- ============================================
-- 说明
-- ============================================
-- 1. flows 表：
--    - id: 工作流唯一标识
--    - name: 工作流名称
--    - description: 工作流描述
--    - data: 工作流的节点和边数据 (JSONB 格式)
--    - owner_id: 用户标识 (你的数据库使用 owner_id，代码也已适配)
--    - icon_kind: 图标类型 ('emoji' | 'image')
--    - icon_name: 图标名称（emoji 字符串或名称）
--    - icon_url: 图标 URL（如果是图片类型）
--    - node_count: 节点数量缓存
--    - created_at: 创建时间
--    - updated_at: 更新时间
--
-- 2. chat_history 表：
--    - id: 聊天记录唯一标识
--    - flow_id: 关联的工作流 ID (外键)
--    - user_message: 用户发送的消息
--    - assistant_message: AI 助手的回复
--    - created_at: 创建时间
--    - updated_at: 更新时间
