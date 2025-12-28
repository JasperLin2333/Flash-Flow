-- ImageGen Models Capabilities V2 Migration
-- 更新 capabilities JSONB 结构以支持动态参数
-- Seed 策略: 不传递 seed 参数，使用模型厂家默认值

-- Step 1: Kolors - 使用 guidance_scale
UPDATE image_gen_models SET capabilities = jsonb_build_object(
    'supportsNegativePrompt', true,
    'supportsImageSize', true,
    'supportsReferenceImage', false,
    'supportsInferenceSteps', true,
    'cfgParam', 'guidance_scale',
    'cfgRange', jsonb_build_object('min', 0, 'max', 20),
    'defaultCfg', 7.5,
    'defaultSteps', 25,
    'imageSizes', jsonb_build_array(
        '1024x1024', '960x1280', '768x1024', '720x1440', '720x1280'
    )
) WHERE model_id = 'Kwai-Kolors/Kolors';

-- Step 2: Qwen-Image - 使用 cfg
UPDATE image_gen_models SET capabilities = jsonb_build_object(
    'supportsNegativePrompt', true,
    'supportsImageSize', true,
    'supportsReferenceImage', false,
    'supportsInferenceSteps', true,
    'cfgParam', 'cfg',
    'cfgRange', jsonb_build_object('min', 0.1, 'max', 20),
    'defaultCfg', 4.0,
    'defaultSteps', 50,
    'imageSizes', jsonb_build_array(
        '1328x1328', '1664x928', '928x1664', '1472x1140', 
        '1140x1472', '1584x1056', '1056x1584'
    )
) WHERE model_id = 'Qwen/Qwen-Image';

-- Step 3: Qwen-Image-Edit - 使用 cfg, 不支持 image_size, 支持多图
UPDATE image_gen_models SET capabilities = jsonb_build_object(
    'supportsNegativePrompt', true,
    'supportsImageSize', false,
    'supportsReferenceImage', true,
    'supportsInferenceSteps', true,
    'cfgParam', 'cfg',
    'cfgRange', jsonb_build_object('min', 0.1, 'max', 20),
    'defaultCfg', 4.0,
    'defaultSteps', 50,
    'imageSizes', null,
    'maxReferenceImages', 3
) WHERE model_id = 'Qwen/Qwen-Image-Edit-2509';

-- Verify migration
SELECT model_id, model_name, capabilities FROM image_gen_models;
