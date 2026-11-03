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
    // rPPG 실험실 WASM 런타임 (node_modules에서 복사된 서드파티 파일)
    "public/vendor/**",
    // Electron 산출물·패키징 출력
    "dist-electron/**",
    "release/**",
  ]),
]);

export default eslintConfig;
