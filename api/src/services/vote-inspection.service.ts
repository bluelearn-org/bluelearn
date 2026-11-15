import type { SupabaseClient } from "@supabase/supabase-js";
import {
  downvoteInspectionResponseSchema,
  type Pagination,
} from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";

export async function inspectDownvotes(
  supabase: SupabaseClient<Database>,
  target: { guideId: string } | { caseId: string },
  { page, limit }: Pagination
) {
  const { data, error } = await supabase.rpc("inspect_guide_downvotes", {
    ...("guideId" in target
      ? { p_guide_id: target.guideId }
      : { p_case_id: target.caseId }),
    p_page: page,
    p_limit: limit,
  });

  if (error) {
    if (error.code === "42501")
      throw new ServiceError("You cannot inspect these downvotes", 403);
    if (error.code === "P0002") throw new ServiceError("Guide not found", 404);
    if (error.code === "22023")
      throw new ServiceError("Invalid downvote inspection parameters", 400);

    console.error(error);
    throw new ServiceError("Failed to load downvotes", 500);
  }

  return downvoteInspectionResponseSchema.parse(data);
}
