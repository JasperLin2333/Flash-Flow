-- Migration: Update image_gen_models capabilities.imageSizes to use object format
-- Date: 2025-12-28
-- 
-- This migration converts imageSizes from string[] to {value: string, label: string}[]
-- to store display names directly in the database instead of hardcoding in frontend.

-- Update Kolors model
UPDATE image_gen_models
SET capabilities = jsonb_set(
  capabilities,
  '{imageSizes}',
  '[
    {"value": "1024x1024", "label": "1:1 正方形"},
    {"value": "960x1280", "label": "3:4 竖版"},
    {"value": "768x1024", "label": "3:4 竖版"},
    {"value": "720x1440", "label": "1:2 竖版"},
    {"value": "720x1280", "label": "9:16 竖版"}
  ]'::jsonb
)
WHERE model_id = 'Kwai-Kolors/Kolors';

-- Update Qwen-Image model
UPDATE image_gen_models
SET capabilities = jsonb_set(
  capabilities,
  '{imageSizes}',
  '[
    {"value": "1328x1328", "label": "1:1 正方形"},
    {"value": "1664x928", "label": "16:9 横版"},
    {"value": "928x1664", "label": "9:16 竖版"},
    {"value": "1472x1140", "label": "4:3 横版"},
    {"value": "1140x1472", "label": "3:4 竖版"},
    {"value": "1584x1056", "label": "3:2 横版"},
    {"value": "1056x1584", "label": "2:3 竖版"}
  ]'::jsonb
)
WHERE model_id = 'Qwen/Qwen-Image';

-- Update Qwen-Image-Edit-2509 model (no imageSizes, set to null explicitly)
UPDATE image_gen_models
SET capabilities = jsonb_set(
  capabilities,
  '{imageSizes}',
  'null'::jsonb
)
WHERE model_id = 'Qwen/Qwen-Image-Edit-2509';
