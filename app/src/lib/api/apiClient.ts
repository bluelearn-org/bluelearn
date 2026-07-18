import { hc } from "hono/client";
import type { AppType } from "api";

export const client = hc<AppType>(import.meta.env.VITE_API_BASE);
