-- Flash Flow - Supabase Database Schema
-- Synchronized with production database
-- Date: 2025-12-09

-- WARNING: This schema is for documentation and context only.
-- Always verify against actual database before making changes.

-- Enable necessary extensions for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ==========================================
-- 1. Flows Table
-- Stores workflow definitions
-- ==========================================
CREATE TABLE IF NOT EXISTS flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    description TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    icon_kind TEXT DEFAULT 'emoji',
    icon_name TEXT,
    icon_url TEXT,
    node_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flows_owner_id ON flows(owner_id);
CREATE INDEX IF NOT EXISTS idx_flows_created_at ON flows(created_at DESC);
-- Note: Duplicate indexes exist in production (flows_owner_id_idx, flows_created_at_idx)
CREATE INDEX IF NOT EXISTS flows_owner_id_idx ON flows(owner_id);
CREATE INDEX IF NOT EXISTS flows_created_at_idx ON flows(created_at DESC);

-- RLS Policies
CREATE POLICY "Users can view their own flows" ON flows
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own flows" ON flows
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own flows" ON flows
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own flows" ON flows
    FOR DELETE USING (auth.uid() = owner_id);


-- ==========================================
-- 2. Chat History Table
-- Stores chat messages for workflows
-- ==========================================
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL, -- No foreign key constraint in production
    user_message TEXT NOT NULL,
    assistant_message TEXT,
    session_id TEXT,
    execution_status TEXT DEFAULT 'pending',
    execution_started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_history_flow_id ON chat_history(flow_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_execution_status 
    ON chat_history(session_id, execution_status) 
    WHERE (execution_status = 'pending');

-- RLS Policies (Multiple policies exist for backwards compatibility)
CREATE POLICY "Enable read access for all users" ON chat_history
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON chat_history
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON chat_history
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON chat_history
    FOR DELETE USING (true);

CREATE POLICY "Users can view chat history of their flows" ON chat_history
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM flows WHERE flows.id = chat_history.flow_id AND flows.owner_id = auth.uid()
    ));

CREATE POLICY "Users can insert chat history for their flows" ON chat_history
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM flows WHERE flows.id = chat_history.flow_id AND flows.owner_id = auth.uid()
    ));

CREATE POLICY "Users can update chat history of their flows" ON chat_history
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM flows WHERE flows.id = chat_history.flow_id AND flows.owner_id = auth.uid()
    ));

CREATE POLICY "Users can delete chat history of their flows" ON chat_history
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM flows WHERE flows.id = chat_history.flow_id AND flows.owner_id = auth.uid()
    ));


-- ==========================================
-- 3. Flow Executions Table
-- Logs execution runs of workflows
-- ==========================================
CREATE TABLE IF NOT EXISTS flow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flow_id UUID NOT NULL REFERENCES flows(id),
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    input_params JSONB DEFAULT '{}'::jsonb,
    output_result JSONB DEFAULT '{}'::jsonb,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE flow_executions ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flow_executions_flow_id ON flow_executions(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_user_id ON flow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_created_at ON flow_executions(created_at DESC);

-- RLS Policies
CREATE POLICY "Users can view their own executions" ON flow_executions
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own executions" ON flow_executions
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);


-- ==========================================
-- 4. Knowledge Files Table
-- Manages uploaded files for RAG/Knowledge base
-- ==========================================
CREATE TABLE IF NOT EXISTS knowledge_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    status TEXT DEFAULT 'processing',
    token_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE knowledge_files ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_files_user_id ON knowledge_files(user_id);

-- RLS Policies
CREATE POLICY "Users can view own files" ON knowledge_files
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can upload own files" ON knowledge_files
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own files" ON knowledge_files
    FOR DELETE USING (auth.uid()::text = user_id);


-- ==========================================
-- 5. LLM Models Table
-- Available LLM models configuration
-- ==========================================
CREATE TABLE IF NOT EXISTS llm_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id TEXT NOT NULL UNIQUE,
    model_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE llm_models ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_llm_models_provider ON llm_models(provider);
CREATE INDEX IF NOT EXISTS idx_llm_models_is_active ON llm_models(is_active);
CREATE INDEX IF NOT EXISTS idx_llm_models_active ON llm_models(is_active, display_order);

-- RLS Policies
CREATE POLICY "Anyone can read llm_models" ON llm_models
    FOR SELECT USING (true);


-- ==========================================
-- 6. Users Quota Table
-- Tracks user usage limits and consumption
-- ==========================================
CREATE TABLE IF NOT EXISTS users_quota (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
    llm_executions_used INTEGER DEFAULT 0,
    flow_generations_used INTEGER DEFAULT 0,
    app_usages_used INTEGER DEFAULT 0,
    llm_executions_limit INTEGER DEFAULT 100,
    flow_generations_limit INTEGER DEFAULT 20,
    app_usages_limit INTEGER DEFAULT 50,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users_quota ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_quota_user_id ON users_quota(user_id);

-- RLS Policies
CREATE POLICY "Users can view their own quota" ON users_quota
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own quota" ON users_quota
    FOR UPDATE USING (auth.uid() = user_id);


-- ==========================================
-- 7. File Uploads Table
-- Stores file metadata and Supabase Storage URLs for Input nodes
-- ==========================================
CREATE TABLE IF NOT EXISTS file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id TEXT NOT NULL,
    flow_id UUID REFERENCES flows(id), -- No CASCADE in production
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    uploaded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_file_uploads_node_id ON file_uploads(node_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_flow_id ON file_uploads(flow_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_uploaded_by ON file_uploads(uploaded_by);

-- Note: Create Storage Bucket separately in Supabase Dashboard
-- Bucket name: 'workflow-uploads'
-- Public: false (requires authentication for security)
-- File size limit: Configure in dashboard (recommended: 50MB per file)
-- Allowed MIME types: Configure in dashboard or set to allow all


-- ==========================================
-- 8. LLM Node Memory Table
-- Stores conversation history for LLM nodes with memory enabled
-- ==========================================
CREATE TABLE IF NOT EXISTS llm_node_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES flows(id), -- No CASCADE in production
    node_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    turn_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE llm_node_memory ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_llm_node_memory_lookup 
    ON llm_node_memory(flow_id, node_id, session_id, turn_index);
CREATE INDEX IF NOT EXISTS idx_llm_node_memory_flow_id 
    ON llm_node_memory(flow_id);

-- RLS Policies
CREATE POLICY "Allow all operations on llm_node_memory" ON llm_node_memory
    FOR ALL USING (true);


-- ==========================================
-- 9. User Profiles Table
-- Stores user display names and custom avatars
-- ==========================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    display_name TEXT,
    avatar_kind TEXT DEFAULT 'emoji' CHECK (avatar_kind IN ('emoji', 'image')),
    avatar_emoji TEXT DEFAULT '👤',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- RLS Policies
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);


-- ==========================================
-- 10. Storage Buckets & Policies
-- ==========================================

-- Create 'user-avatars' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Public read access for user-avatars
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'user-avatars' );

-- Policy: Authenticated users can upload their own avatar
CREATE POLICY "Authenticated users can upload avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-avatars' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-avatars' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-avatars' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);


-- Create 'flow-icons' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('flow-icons', 'flow-icons', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Public read access for flow-icons
CREATE POLICY "Public Access Flow Icons"
ON storage.objects FOR SELECT
USING ( bucket_id = 'flow-icons' );

-- Policy: Authenticated users can upload flow icons
CREATE POLICY "Authenticated users can upload flow icons"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'flow-icons' AND
  auth.role() = 'authenticated'
);

-- Policy: Users can update flow icons
CREATE POLICY "Users can update flow icons"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'flow-icons' AND
  auth.role() = 'authenticated'
);

-- Policy: Users can delete flow icons
CREATE POLICY "Users can delete flow icons"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'flow-icons' AND
  auth.role() = 'authenticated'
);

-- Create 'flow-files' bucket for code interpreter output files
INSERT INTO storage.buckets (id, name, public)
VALUES ('flow-files', 'flow-files', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Public read access for flow-files
CREATE POLICY "Public Access Flow Files"
ON storage.objects FOR SELECT
USING ( bucket_id = 'flow-files' );

-- Policy: Authenticated users can upload files
CREATE POLICY "Authenticated users can upload flow files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'flow-files' AND
  auth.role() = 'authenticated'
);