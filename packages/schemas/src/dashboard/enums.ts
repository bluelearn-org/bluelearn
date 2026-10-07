import { z } from "zod";
import { roleSchema } from "../identity/enums";

export const userStatusSchema = z.enum(["active", "inactive", "suspended"]);

// One list of roles for the whole API, so /me cannot disagree with the
// dashboard about which roles exist.
export const userRoleSchema = roleSchema;
