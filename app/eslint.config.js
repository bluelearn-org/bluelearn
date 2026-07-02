//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      ".output/",
      ".nitro/",
      ".tanstack/",
      ".vinxi/",
      "dist/",
      "dist-ssr/",
      "src/routeTree.gen.ts",
    ],
  },
  ...tanstackConfig,
  prettier,
];
