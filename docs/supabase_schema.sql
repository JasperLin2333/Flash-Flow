-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "amcheck";
CREATE EXTENSION IF NOT EXISTS "postgres_fdw";
CREATE EXTENSION IF NOT EXISTS "pageinspect";
CREATE EXTENSION IF NOT EXISTS "http";
CREATE EXTENSION IF NOT EXISTS "rum";
CREATE EXTENSION IF NOT EXISTS "pgrouting";
CREATE EXTENSION IF NOT EXISTS "pgtap";
CREATE EXTENSION IF NOT EXISTS "pgroonga_database";
CREATE EXTENSION IF NOT EXISTS "pg_tle";
CREATE EXTENSION IF NOT EXISTS "dict_int";
CREATE EXTENSION IF NOT EXISTS "cube";
CREATE EXTENSION IF NOT EXISTS "pg_visibility";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "file_fdw";
CREATE EXTENSION IF NOT EXISTS "tablefunc";
CREATE EXTENSION IF NOT EXISTS "autoinc";
CREATE EXTENSION IF NOT EXISTS "pg_partman";
CREATE EXTENSION IF NOT EXISTS "pgmq";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "hypopg";
CREATE EXTENSION IF NOT EXISTS "postgis_raster";
CREATE EXTENSION IF NOT EXISTS "hstore";
CREATE EXTENSION IF NOT EXISTS "refint";
CREATE EXTENSION IF NOT EXISTS "lo";
CREATE EXTENSION IF NOT EXISTS "insert_username";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "wal2json";

-- Create Tables
CREATE TABLE IF NOT EXISTS public.chat_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    flow_id uuid NOT NULL,
    user_message text NOT NULL,
    assistant_message text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    session_id text,
    execution_status text DEFAULT 'pending'::text,
    execution_started_at timestamptz,
    user_attachments jsonb DEFAULT '[]'::jsonb,
    assistant_attachments jsonb DEFAULT '[]'::jsonb,
    assistant_reasoning text,
    token_usage jsonb
);

CREATE TABLE IF NOT EXISTS public.flows (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name text NOT NULL,
    description text,
    nodes jsonb DEFAULT '[]'::jsonb NOT NULL,
    edges jsonb DEFAULT '[]'::jsonb NOT NULL,
    viewport jsonb DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    owner_id uuid DEFAULT auth.uid() NOT NULL,
    is_public boolean DEFAULT false,
    version integer DEFAULT 1,
    tags text[] DEFAULT '{}'::text[],
    thumbnail_url text,
    execution_config jsonb DEFAULT '{}'::jsonb,
    rag_config jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.file_uploads (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    flow_id uuid REFERENCES public.flows(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_type text,
    file_size integer,
    uploaded_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.flow_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    flow_id uuid REFERENCES public.flows(id) ON DELETE CASCADE,
    input_data jsonb DEFAULT '{}'::jsonb,
    output_data jsonb,
    status text DEFAULT 'pending'::text,
    error text,
    started_at timestamptz DEFAULT timezone('utc'::text, now()),
    completed_at timestamptz,
    logs jsonb DEFAULT '[]'::jsonb,
    user_id text,
    CONSTRAINT flow_executions_status_check CHECK (status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text]))
);

CREATE TABLE IF NOT EXISTS public.image_gen_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    model_id text UNIQUE,
    model_name text,
    provider text DEFAULT 'siliconflow'::text,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    capabilities jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.knowledge_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id text NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type text,
    status text DEFAULT 'processing'::text,
    token_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.llm_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    model_id text NOT NULL UNIQUE,
    model_name text NOT NULL,
    provider text NOT NULL,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    capabilities jsonb DEFAULT '{"hasReasoning": false, "supportsJsonMode": true, "hasReasoningEffort": false, "supportsStreamingReasoning": false}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.llm_node_memory (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
    node_id text NOT NULL,
    session_id text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    turn_index integer NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE,
    display_name text,
    avatar_kind text DEFAULT 'emoji'::text,
    avatar_emoji text DEFAULT '👤'::text,
    avatar_url text,
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT user_profiles_avatar_kind_check CHECK (avatar_kind = ANY (ARRAY['emoji'::text, 'image'::text]))
);

CREATE TABLE IF NOT EXISTS public.users_quota (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE,
    llm_executions_used integer DEFAULT 0,
    flow_generations_used integer DEFAULT 0,
    app_usages_used integer DEFAULT 0,
    llm_executions_limit integer DEFAULT 100,
    flow_generations_limit integer DEFAULT 20,
    app_usages_limit integer DEFAULT 50,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    image_gen_executions_used integer DEFAULT 0,
    image_gen_executions_limit integer DEFAULT 20
);

-- Functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
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
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    50, -- 默认 LLM 执行限制
    0,
    20, -- 默认 Flow 生成限制
    0,
    100, -- 默认 App 使用限制
    0,
    20, -- 默认图片生成限制
    0,
    now(),
    now()
  );
  
  RETURN new;
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

CREATE OR REPLACE FUNCTION public.check_and_increment_quota(p_user_id uuid, p_quota_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_used INT;
  v_limit INT;
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
    WHEN 'image_gen_executions' THEN
      v_column_used := 'image_gen_executions_used';
      v_column_limit := 'image_gen_executions_limit';
    ELSE
      RAISE EXCEPTION 'Invalid quota type: %', p_quota_type;
  END CASE;

  -- Get current values (with explicit locking to prevent race conditions)
  EXECUTE format(
    'SELECT %I, %I FROM users_quota WHERE user_id = $1 FOR UPDATE',
    v_column_used, v_column_limit
  ) INTO v_current_used, v_limit USING p_user_id;

  -- Initialize if not exists (should be handled by trigger, but safe guard)
  IF v_current_used IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check limit
  IF v_current_used >= v_limit THEN
    RETURN FALSE;
  END IF;

  -- Increment usage
  EXECUTE format(
    'UPDATE users_quota SET %I = %I + 1 WHERE user_id = $1',
    v_column_used, v_column_used
  ) USING p_user_id;

  RETURN TRUE;
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

  -- Get current values
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

-- Triggers
-- Note: 'create_user_quota' was found in functions but no trigger using it was found in 'public' schema triggers. It might be an auth trigger.
-- 'handle_new_user' is likely an auth trigger (on auth.users), which cannot be created directly via SQL editor usually, but we include it for reference.
CREATE TRIGGER set_users_quota_updated_at BEFORE UPDATE ON public.users_quota FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER update_flows_updated_at BEFORE UPDATE ON public.flows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes (Explicitly fetched)
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_users_quota_user_id ON public.users_quota USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_flow_id ON public.file_uploads USING btree (flow_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_node_id ON public.file_uploads USING btree (((file_path)::text)); -- Approximate from index name 'idx_file_uploads_node_id' if not standard
CREATE INDEX IF NOT EXISTS idx_flow_executions_flow_id ON public.flow_executions USING btree (flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_user_id ON public.flow_executions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_flows_owner_id ON public.flows USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_flows_owner_is_public ON public.flows USING btree (owner_id, is_public);
CREATE INDEX IF NOT EXISTS idx_flows_tags ON public.flows USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_user_id ON public.knowledge_files USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_llm_node_memory_flow_id ON public.llm_node_memory USING btree (flow_id);
CREATE INDEX IF NOT EXISTS idx_llm_node_memory_lookup ON public.llm_node_memory USING btree (flow_id, node_id, session_id, turn_index);
CREATE INDEX IF NOT EXISTS idx_llm_models_active ON public.llm_models USING btree (is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_llm_models_is_active ON public.llm_models USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_llm_models_provider ON public.llm_models USING btree (provider);

-- Enable RLS
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_gen_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_node_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_quota ENABLE ROW LEVEL SECURITY;

-- Post-Table Grants (Standard Supabase patterns)
GRANT ALL ON TABLE public.chat_history TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.file_uploads TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.flows TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.flow_executions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.image_gen_models TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.knowledge_files TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.llm_models TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.llm_node_memory TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.users_quota TO anon, authenticated, service_role;

-- Policies
CREATE POLICY "Users can view their own flows" ON public.flows FOR SELECT USING (owner_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert their own flows" ON public.flows FOR INSERT WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY "Users can update their own flows" ON public.flows FOR UPDATE USING (owner_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete their own flows" ON public.flows FOR DELETE USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "Allow public read" ON public.image_gen_models FOR SELECT USING (true);

CREATE POLICY "Users can view own quota" ON public.users_quota FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update their own quota" ON public.users_quota FOR UPDATE USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view own chat history" ON public.chat_history FOR SELECT USING (flow_id IN (SELECT id FROM flows WHERE owner_id = (SELECT auth.uid())));
CREATE POLICY "Users can insert own chat history" ON public.chat_history FOR INSERT WITH CHECK (flow_id IN (SELECT id FROM flows WHERE owner_id = (SELECT auth.uid())));
CREATE POLICY "Users can view own executions" ON public.flow_executions FOR SELECT USING (user_id = (auth.uid())::text);
CREATE POLICY "Users can insert their own executions" ON public.flow_executions FOR INSERT WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY "User can access memory of their flows" ON public.llm_node_memory FOR ALL USING ((SELECT auth.uid()) = (SELECT owner_id FROM public.flows WHERE id = llm_node_memory.flow_id)) WITH CHECK ((SELECT auth.uid()) = (SELECT owner_id FROM public.flows WHERE id = llm_node_memory.flow_id));

CREATE POLICY "Anyone can read llm_models" ON public.llm_models FOR SELECT USING (true);

CREATE POLICY "Users can view files from own flows" ON public.file_uploads FOR SELECT USING (flow_id IN (SELECT id FROM flows WHERE owner_id = (SELECT auth.uid())));
CREATE POLICY "Users can insert files to own flows" ON public.file_uploads FOR INSERT WITH CHECK (flow_id IN (SELECT id FROM flows WHERE owner_id = (SELECT auth.uid())));
CREATE POLICY "Users can delete files from own flows" ON public.file_uploads FOR DELETE USING (flow_id IN (SELECT id FROM flows WHERE owner_id = (SELECT auth.uid())));

-- Storage Buckets & Policies
INSERT INTO storage.buckets (id, name, public) VALUES ('user-avatars', 'user-avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('flow-icons', 'flow-icons', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('workflow-uploads', 'workflow-uploads', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('flow-files', 'flow-files', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-images', 'generated-images', true) ON CONFLICT (id) DO NOTHING;

-- Storage Policies (RLS for objects)
-- Note: 'storage.policies' is not a real table, but we use SQL to create policies on 'storage.objects'
CREATE POLICY "Allow public updates to workflow-uploads" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'workflow-uploads'::text);
CREATE POLICY "Allow public uploads to workflow-uploads" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'workflow-uploads'::text);

CREATE POLICY "Authenticated users can upload avatar" ON storage.objects FOR INSERT TO public WITH CHECK ((bucket_id = 'user-avatars'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
CREATE POLICY "Authenticated users can upload flow icons" ON storage.objects FOR INSERT TO public WITH CHECK ((bucket_id = 'flow-icons'::text) AND (auth.role() = 'authenticated'::text));
CREATE POLICY "Authenticated users can upload to flow-files" ON storage.objects FOR INSERT TO public WITH CHECK ((bucket_id = 'flow-files'::text) AND (auth.role() = 'authenticated'::text));

CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'user-avatars'::text);
CREATE POLICY "Public Access Flow Icons" ON storage.objects FOR SELECT TO public USING (bucket_id = 'flow-icons'::text);
CREATE POLICY "Public Access to flow-files" ON storage.objects FOR SELECT TO public USING (bucket_id = 'flow-files'::text);

CREATE POLICY "Users can update flow icons" ON storage.objects FOR UPDATE TO public USING ((bucket_id = 'flow-icons'::text) AND (auth.role() = 'authenticated'::text));
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE TO public USING ((bucket_id = 'user-avatars'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));

-- User Events Table (Added for Tracking System)
CREATE TABLE IF NOT EXISTS public.user_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid, -- Nullable to support potential anonymous tracking
    event_name text NOT NULL,
    event_data jsonb DEFAULT '{}'::jsonb,
    session_id text,
    page text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for user_events
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON public.user_events USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_event_name ON public.user_events USING btree (event_name);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON public.user_events USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_user_events_session_id ON public.user_events USING btree (session_id);

-- Enable RLS for user_events
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

-- Grants for user_events
GRANT ALL ON TABLE public.user_events TO anon, authenticated, service_role;

-- Policies for user_events
-- Allow any user (anon or auth) to insert events
CREATE POLICY "Enable insert for all users" ON public.user_events FOR INSERT WITH CHECK (true);

-- Allow users to view their own events (optional, mostly for debugging/user data request)
CREATE POLICY "Users can view their own events" ON public.user_events FOR SELECT USING ((auth.uid() = user_id) OR (user_id IS NULL AND session_id IS NOT NULL));
