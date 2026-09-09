import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const isTest = Boolean(process.env.VITEST);

const config = defineConfig({
  plugins: [
    ...(!isTest ? [devtools(), nitro()] : []),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    ...(!isTest ? [tanstackStart()] : []),
    viteReact(),
  ],

  server: {
    host: "127.0.0.1",
  },
});

export default config;
