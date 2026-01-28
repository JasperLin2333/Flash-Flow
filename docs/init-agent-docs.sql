-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Drop existing table if exists (to handle dimension change)
DROP TABLE IF EXISTS agent_docs CASCADE;

-- Create agent_docs table
CREATE TABLE IF NOT EXISTS agent_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  keywords text[] DEFAULT ARRAY[]::text[],
  category text,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector(1024),
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Create IVFFlat index (optimal for small datasets)
CREATE INDEX IF NOT EXISTS idx_agent_docs_embedding
  ON agent_docs
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- Create vector search function
CREATE OR REPLACE FUNCTION public.match_agent_docs(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 3,
  category_filter text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  title text,
  content text,
  similarity float
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT
    agent_docs.id,
    agent_docs.title,
    agent_docs.content,
    1 - (agent_docs.embedding <=> query_embedding) as similarity
  FROM agent_docs
  WHERE
    (category_filter IS NULL OR agent_docs.category = category_filter) AND
    (1 - (agent_docs.embedding <=> query_embedding)) > match_threshold
  ORDER BY agent_docs.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Enable RLS (public read access, service role can write)
ALTER TABLE agent_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to agent docs"
  ON agent_docs
  FOR SELECT
  USING (true);
