import type { Database } from "../database.types";

type CaseType = Database["public"]["Enums"]["case_type"];

// Baseline panel size per case type. Read at assembly, passed to the RPC, and
// frozen onto the panel; the RPC clamps it down to the eligible pool and rounds
// to odd. A governance number, not a table: it changes only on a policy decision.
export const PANEL_POLICY_DEFAULTS: Record<CaseType, number> = {
  guide_publish: 3,
  guide_edit: 3,
};
