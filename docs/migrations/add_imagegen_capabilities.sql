-- ImageGen Models Capabilities Migration
-- Adds capabilities JSONB column to image_gen_models table for dynamic form field rendering

-- Step 1: Add capabilities column
ALTER TABLE image_gen_models 
ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '{}'::jsonb;

-- Step 2: Update existing models with their capabilities
-- Kolors (可灵) - supports negative prompt and guidance scale
UPDATE image_gen_models SET capabilities = jsonb_build_object(
    'supportsNegativePrompt', true,
    'supportsGuidanceScale', true,
    'supportsReferenceImage', false,
    'defaultGuidanceScale', 7.5,
    'defaultSteps', 25
) WHERE model_id = 'Kwai-Kolors/Kolors';

-- Qwen 文生图 - supports negative prompt and guidance scale
UPDATE image_gen_models SET capabilities = jsonb_build_object(
    'supportsNegativePrompt', true,
    'supportsGuidanceScale', true,
    'supportsReferenceImage', false,
    'defaultGuidanceScale', 7.5,
    'defaultSteps', 25
) WHERE model_id = 'Qwen/Qwen-Image';

-- Qwen 图生图 (Image Edit) - supports all including reference image
UPDATE image_gen_models SET capabilities = jsonb_build_object(
    'supportsNegativePrompt', true,
    'supportsGuidanceScale', true,
    'supportsReferenceImage', true,
    'defaultGuidanceScale', 7.5,
    'defaultSteps', 25
) WHERE model_id = 'Qwen/Qwen-Image-Edit-2509';

-- Verify migration
SELECT model_id, model_name, capabilities FROM image_gen_models;
