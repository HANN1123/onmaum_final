import type { NextConfig } from "next";

// Electron 빌드(ONMAUM_TARGET=electron)에서만 정적 export를 켠다. 기본 웹 빌드는 그대로다.
const isElectronTarget = process.env.ONMAUM_TARGET === "electron";

const nextConfig: NextConfig = isElectronTarget
  ? { output: "export", trailingSlash: true }
  : {};

export default nextConfig;
