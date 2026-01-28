-- ==============================================================================
-- Supabase Database Full Schema Export
-- Generated at: 2026-01-26
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Extensions
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- ------------------------------------------------------------------------------
-- 2. Tables & Columns
-- ------------------------------------------------------------------------------

CREATE TABLE public.agent_docs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    title text NOT NULL,
    content text NOT NULL,
    keywords text[] DEFAULT ARRAY[]::text[],
    category text,
    metadata jsonb DEFAULT '{}'::jsonb,
    embedding vector,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT agent_docs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.app_config (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT app_config_pkey PRIMARY KEY (key)
);

INSERT INTO public.app_config (key, value)
VALUES ('initial_points', '100')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

CREATE TABLE public.chat_history (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    flow_id uuid NOT NULL,
    user_message text NOT NULL,
    assistant_message text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    session_id text,
    execution_status text DEFAULT 'pending'::text,
    execution_started_at timestamp with time zone,
    user_attachments jsonb DEFAULT '[]'::jsonb,
    assistant_attachments jsonb DEFAULT '[]'::jsonb,
    assistant_reasoning text,
    token_usage jsonb,
    CONSTRAINT chat_history_pkey PRIMARY KEY (id)
);

CREATE TABLE public.file_uploads (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    node_id text NOT NULL,
    flow_id uuid,
    file_name text NOT NULL,
    file_type text NOT NULL,
    file_size integer NOT NULL,
    storage_path text NOT NULL,
    storage_url text NOT NULL,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT file_uploads_pkey PRIMARY KEY (id)
);

CREATE TABLE public.flow_executions (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    flow_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text,
    input_params jsonb DEFAULT '{}'::jsonb,
    output_result jsonb DEFAULT '{}'::jsonb,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT flow_executions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.flows (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    owner_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    icon_kind text DEFAULT 'emoji'::text,
    icon_name text,
    icon_url text,
    node_count integer DEFAULT 0,
    CONSTRAINT flows_pkey PRIMARY KEY (id)
);

CREATE TABLE public.image_gen_models (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    model_id text NOT NULL,
    model_name text NOT NULL,
    provider text DEFAULT 'siliconflow'::text,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    capabilities jsonb DEFAULT '{}'::jsonb,
    points_cost integer DEFAULT 12,
    CONSTRAINT image_gen_models_pkey PRIMARY KEY (id),
    CONSTRAINT image_gen_models_model_id_key UNIQUE (model_id)
);

CREATE TABLE public.knowledge_files (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    user_id uuid NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type text,
    status text DEFAULT 'processing'::text,
    token_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT knowledge_files_pkey PRIMARY KEY (id)
);

CREATE TABLE public.llm_models (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    model_id text NOT NULL,
    model_name text NOT NULL,
    provider text NOT NULL,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    capabilities jsonb DEFAULT '{"hasReasoning": false, "supportsJsonMode": true, "hasReasoningEffort": false, "supportsStreamingReasoning": false}'::jsonb,
    points_cost integer DEFAULT 3,
    CONSTRAINT llm_models_pkey PRIMARY KEY (id),
    CONSTRAINT llm_models_model_id_key UNIQUE (model_id)
);

CREATE TABLE public.llm_node_memory (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    flow_id uuid NOT NULL,
    node_id text NOT NULL,
    session_id text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    turn_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT llm_node_memory_pkey PRIMARY KEY (id)
);

CREATE TABLE public.points_ledger (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    action_type text NOT NULL,
    item_key text,
    title text,
    points integer NOT NULL,
    balance_after integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT points_ledger_pkey PRIMARY KEY (id)
);

CREATE TABLE public.user_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid,
    session_id text NOT NULL,
    event_name text NOT NULL,
    event_data jsonb DEFAULT '{}'::jsonb,
    page text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_events_pkey PRIMARY KEY (id)
);

CREATE TABLE public.user_profiles (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    user_id uuid NOT NULL,
    display_name text,
    avatar_kind text DEFAULT 'emoji'::text,
    avatar_emoji text DEFAULT '👤'::text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    preferences jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
    CONSTRAINT user_profiles_user_id_key UNIQUE (user_id)
);

CREATE TABLE public.users_quota (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    user_id uuid NOT NULL,
    llm_executions_used integer DEFAULT 0,
    flow_generations_used integer DEFAULT 0,
    app_usages_used integer DEFAULT 0,
    llm_executions_limit integer DEFAULT 100,
    flow_generations_limit integer DEFAULT 20,
    app_usages_limit integer DEFAULT 50,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    image_gen_executions_used integer DEFAULT 0,
    image_gen_executions_limit integer DEFAULT 20,
    points_balance integer DEFAULT 0,
    points_used integer DEFAULT 0,
    CONSTRAINT users_quota_pkey PRIMARY KEY (id),
    CONSTRAINT users_quota_user_id_key UNIQUE (user_id)
);

-- ------------------------------------------------------------------------------
-- 3. Foreign Keys
-- ------------------------------------------------------------------------------

ALTER TABLE public.chat_history ADD CONSTRAINT chat_history_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES public.flows(id) ON DELETE CASCADE;
ALTER TABLE public.file_uploads ADD CONSTRAINT file_uploads_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES public.flows(id);
ALTER TABLE public.file_uploads ADD CONSTRAINT file_uploads_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.flow_executions ADD CONSTRAINT flow_executions_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES public.flows(id);
ALTER TABLE public.flow_executions ADD CONSTRAINT flow_executions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.flows ADD CONSTRAINT flows_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.knowledge_files ADD CONSTRAINT knowledge_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.llm_node_memory ADD CONSTRAINT llm_node_memory_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES public.flows(id);
ALTER TABLE public.points_ledger ADD CONSTRAINT points_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.user_events ADD CONSTRAINT user_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.users_quota ADD CONSTRAINT users_quota_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------------------
-- 4. Indexes
-- ------------------------------------------------------------------------------

CREATE INDEX idx_agent_docs_embedding ON public.agent_docs USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_chat_history_flow_id ON public.chat_history USING btree (flow_id);
CREATE INDEX idx_file_uploads_flow_id ON public.file_uploads USING btree (flow_id);
CREATE INDEX idx_file_uploads_uploaded_by ON public.file_uploads USING btree (uploaded_by);
CREATE INDEX idx_flow_executions_created_at ON public.flow_executions USING btree (created_at DESC);
CREATE INDEX idx_flow_executions_flow_id ON public.flow_executions USING btree (flow_id);
CREATE INDEX idx_flow_executions_user_id ON public.flow_executions USING btree (user_id);
CREATE INDEX idx_flows_created_at ON public.flows USING btree (created_at DESC);
CREATE INDEX idx_flows_owner_id ON public.flows USING btree (owner_id);
CREATE INDEX idx_knowledge_files_user_id ON public.knowledge_files USING btree (user_id);
CREATE INDEX idx_llm_models_active ON public.llm_models USING btree (is_active, display_order);
CREATE INDEX idx_llm_node_memory_flow_id ON public.llm_node_memory USING btree (flow_id);
CREATE INDEX idx_llm_node_memory_lookup ON public.llm_node_memory USING btree (flow_id, node_id, session_id, turn_index);
CREATE INDEX idx_user_events_user_id ON public.user_events USING btree (user_id);
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles USING btree (user_id);
CREATE INDEX points_ledger_user_id_created_at_idx ON public.points_ledger USING btree (user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 5. Functions & Triggers
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE init_points integer;
BEGIN
  init_points := public.get_config_int('initial_points', 100);

  INSERT INTO public.users_quota (
    user_id,
    llm_executions_limit,
    llm_executions_used,
    flow_generations_limit,
    flow_generations_used,
    app_usages_limit,
    app_usages_used,
    image_gen_executions_limit,
    image_gen_executions_used,
    points_balance,
    points_used,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    50,
    0,
    20,
    0,
    100,
    0,
    20,
    0,
    init_points,
    0,
    NOW(),
    NOW()
  );

  INSERT INTO public.points_ledger (
    user_id,
    action_type,
    item_key,
    title,
    points,
    balance_after,
    created_at
  )
  VALUES (
    NEW.id,
    'tool_usage',
    'initial_grant',
    '初始积分',
    init_points,
    init_points,
    NOW()
  );
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_config_int(k text, default_value integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_int integer;
BEGIN
  SELECT value::integer INTO v_int FROM public.app_config WHERE key = k;
  IF v_int IS NULL THEN
    RETURN default_value;
  END IF;
  RETURN v_int;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_user_quota()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO public.users_quota (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
  SELECT auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.match_agent_docs(query_embedding vector, match_threshold double precision, match_count integer, category_filter text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, title text, content text, similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.check_and_increment_quota(p_user_id uuid, p_quota_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_used INT;
  v_current_limit INT;
  v_column_used TEXT;
  v_column_limit TEXT;
BEGIN
  -- Map quota type to column names
  CASE p_quota_type
    WHEN 'llm_executions' THEN
      v_column_used := 'llm_executions_used';
      v_column_limit := 'llm_executions_limit';
    WHEN 'flow_generations' THEN
      v_column_used := 'flow_generations_used';
      v_column_limit := 'flow_generations_limit';
    WHEN 'app_usages' THEN
      v_column_used := 'app_usages_used';
      v_column_limit := 'app_usages_limit';
    ELSE
      RAISE EXCEPTION 'Invalid quota type: %', p_quota_type;
  END CASE;

  -- Lock the row and get current values
  EXECUTE format(
    'SELECT %I, %I FROM users_quota WHERE user_id = $1 FOR UPDATE',
    v_column_used, v_column_limit
  ) INTO v_current_used, v_current_limit USING p_user_id;

  -- Check if quota is available
  IF v_current_used IS NULL THEN
    RETURN FALSE; -- No quota record found
  END IF;

  IF v_current_used >= v_current_limit THEN
    RETURN FALSE; -- Quota exceeded
  END IF;

  -- Atomically increment the usage
  EXECUTE format(
    'UPDATE users_quota SET %I = %I + 1, updated_at = NOW() WHERE user_id = $1',
    v_column_used, v_column_used
  ) USING p_user_id;

  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_quota_status(p_user_id uuid, p_quota_type text)
 RETURNS TABLE(allowed boolean, current_used integer, current_limit integer, remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_used INT;
  v_limit INT;
  v_column_used TEXT;
  v_column_limit TEXT;
BEGIN
  CASE p_quota_type
    WHEN 'llm_executions' THEN
      v_column_used := 'llm_executions_used';
      v_column_limit := 'llm_executions_limit';
    WHEN 'flow_generations' THEN
      v_column_used := 'flow_generations_used';
      v_column_limit := 'flow_generations_limit';
    WHEN 'app_usages' THEN
      v_column_used := 'app_usages_used';
      v_column_limit := 'app_usages_limit';
    ELSE
      RAISE EXCEPTION 'Invalid quota type: %', p_quota_type;
  END CASE;

  EXECUTE format(
    'SELECT %I, %I FROM users_quota WHERE user_id = $1',
    v_column_used, v_column_limit
  ) INTO v_used, v_limit USING p_user_id;

  IF v_used IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT 
    (v_used < v_limit)::BOOLEAN AS allowed,
    v_used AS current_used,
    v_limit AS current_limit,
    (v_limit - v_used) AS remaining;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Auth Trigger
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER update_flows_updated_at BEFORE UPDATE ON public.flows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_users_quota_updated_at BEFORE UPDATE ON public.users_quota FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 6. RLS Policies
-- ------------------------------------------------------------------------------

ALTER TABLE public.agent_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access to agent docs" ON public.agent_docs FOR SELECT USING (true);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read-only access" ON public.app_config FOR SELECT USING (true);

ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete chat history of their flows" ON public.chat_history FOR DELETE USING ((flow_id IN ( SELECT flows.id FROM flows WHERE (flows.owner_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "Users can insert chat history for their flows" ON public.chat_history FOR INSERT WITH CHECK ((flow_id IN ( SELECT flows.id FROM flows WHERE (flows.owner_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "Users can update chat history of their flows" ON public.chat_history FOR UPDATE USING ((flow_id IN ( SELECT flows.id FROM flows WHERE (flows.owner_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "Users can view chat history of their flows" ON public.chat_history FOR SELECT USING ((flow_id IN ( SELECT flows.id FROM flows WHERE (flows.owner_id = ( SELECT auth.uid() AS uid)))));

ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete files from own flows" ON public.file_uploads FOR DELETE USING ((flow_id IN ( SELECT flows.id FROM flows WHERE (flows.owner_id = current_user_id()))));
CREATE POLICY "Users can insert files to own flows" ON public.file_uploads FOR INSERT WITH CHECK ((flow_id IN ( SELECT flows.id FROM flows WHERE (flows.owner_id = current_user_id()))));
CREATE POLICY "Users can view files from own flows" ON public.file_uploads FOR SELECT USING ((flow_id IN ( SELECT flows.id FROM flows WHERE (flows.owner_id = current_user_id()))));

ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own executions" ON public.flow_executions FOR INSERT WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users can view their own executions" ON public.flow_executions FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));

ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete their own flows" ON public.flows FOR DELETE USING ((owner_id = current_user_id()));
CREATE POLICY "Users can insert their own flows" ON public.flows FOR INSERT WITH CHECK ((owner_id = current_user_id()));
CREATE POLICY "Users can update their own flows" ON public.flows FOR UPDATE USING ((owner_id = current_user_id()));
CREATE POLICY "Users can view their own flows" ON public.flows FOR SELECT USING ((owner_id = current_user_id()));

ALTER TABLE public.knowledge_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete own files" ON public.knowledge_files FOR DELETE USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users can upload own files" ON public.knowledge_files FOR INSERT WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users can view own files" ON public.knowledge_files FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));

ALTER TABLE public.image_gen_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON public.image_gen_models FOR SELECT USING (true);

ALTER TABLE public.llm_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read llm_models" ON public.llm_models FOR SELECT USING (true);

ALTER TABLE public.llm_node_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can access memory of their flows" ON public.llm_node_memory FOR ALL USING ((current_user_id() = ( SELECT flows.owner_id FROM flows WHERE (flows.id = llm_node_memory.flow_id)))) WITH CHECK ((current_user_id() = ( SELECT flows.owner_id FROM flows WHERE (flows.id = llm_node_memory.flow_id))));

ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own points ledger" ON public.points_ledger FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Users can view own points ledger" ON public.points_ledger FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own events" ON public.user_events FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Users can view their own events" ON public.user_events FOR SELECT USING (((( SELECT auth.uid() AS uid) = user_id) OR ((user_id IS NULL) AND (session_id IS NOT NULL))));

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));

ALTER TABLE public.users_quota ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can update their own quota" ON public.users_quota FOR UPDATE USING ((user_id = current_user_id()));
CREATE POLICY "Users can view own quota" ON public.users_quota FOR SELECT USING ((user_id = current_user_id()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('user-avatars', 'user-avatars', true, NULL, NULL),
  ('flow-icons', 'flow-icons', true, NULL, NULL),
  ('workflow-uploads', 'workflow-uploads', true, NULL, NULL),
  ('flow-files', 'flow-files', true, NULL, NULL),
  ('generated-images', 'generated-images', true, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Storage public read" ON storage.objects
FOR SELECT USING (
  bucket_id IN ('user-avatars', 'flow-icons', 'workflow-uploads', 'flow-files', 'generated-images')
);

CREATE POLICY "Storage workflow uploads write" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'workflow-uploads');

CREATE POLICY "Storage workflow uploads update" ON storage.objects
FOR UPDATE USING (bucket_id = 'workflow-uploads') WITH CHECK (bucket_id = 'workflow-uploads');

CREATE POLICY "Storage avatars write" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'user-avatars' AND auth.uid() = owner);

CREATE POLICY "Storage avatars update" ON storage.objects
FOR UPDATE USING (bucket_id = 'user-avatars' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'user-avatars' AND auth.uid() = owner);

CREATE POLICY "Storage flow icons write" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'flow-icons' AND auth.uid() = owner);

CREATE POLICY "Storage flow icons update" ON storage.objects
FOR UPDATE USING (bucket_id = 'flow-icons' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'flow-icons' AND auth.uid() = owner);

CREATE POLICY "Storage flow files write" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'flow-files' AND auth.uid() = owner);

CREATE POLICY "Storage flow files update" ON storage.objects
FOR UPDATE USING (bucket_id = 'flow-files' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'flow-files' AND auth.uid() = owner);
