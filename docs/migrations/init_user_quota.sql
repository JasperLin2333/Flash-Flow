-- 1. 创建处理新用户注册的函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 创建触发器
-- 为了安全起见，先删除已有的触发器（如果存在）再重新创建
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. 为现有缺失配额的用户补全数据
-- 找出在 auth.users 中存在但在 public.users_quota 中没有记录的用户
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
SELECT 
    id,
    50, -- 默认 LLM
    0,
    20, -- 默认 Flow
    0,
    100, -- 默认 App
    0,
    20, -- 默认图片
    0,
    now(),
    now()
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.users_quota);
