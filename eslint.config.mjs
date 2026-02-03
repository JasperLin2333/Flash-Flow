import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ],
      "prefer-const": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: [
      "src/components/apps/FlowAppInterface/AppIcon.tsx",
      "src/components/apps/FlowAppInterface/MessageBubble.tsx",
      "src/components/builder/context-hud/ExecutionOutput.tsx",
      "src/components/sidebar/sidebar-shared.tsx",
      "src/components/ui/image-lightbox.tsx",
      "src/components/ui/prompt-bubble.tsx",
      "src/components/builder/node-forms/components/ImageSlotUploader.tsx",
      "src/components/flow/ImageGenDebugDialog.tsx",
      "src/components/flows/IconDisplay.tsx",
      "src/components/run/RunOutputs.tsx",
    ],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
