export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  APP_URL: string;
};

export type HonoEnv = { Bindings: Bindings };
