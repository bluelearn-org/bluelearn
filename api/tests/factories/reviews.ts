import { insert, type Insert } from "../helpers";

export function createReviewCase(
  createdBy: string,
  overrides: Partial<Insert<"review_cases">> = {}
) {
  return insert("review_cases", {
    case_type: "guide_publish",
    status: "pending",
    created_by: createdBy,
    ...overrides,
  });
}

export function createReviewPanel(
  caseId: string,
  overrides: Partial<Insert<"review_panels">> = {}
) {
  return insert("review_panels", {
    case_id: caseId,
    target_seat_count: 1,
    ...overrides,
  });
}

export function createPanelMember(
  panelId: string,
  memberId: string,
  overrides: Partial<Insert<"panel_members">> = {}
) {
  return insert("panel_members", {
    panel_id: panelId,
    member_id: memberId,
    status: "assigned",
    ...overrides,
  });
}

export function createGuideReviewCase(
  caseId: string,
  guideRevisionId: string,
  overrides: Partial<Insert<"guide_review_cases">> = {}
) {
  return insert("guide_review_cases", {
    case_id: caseId,
    guide_revision_id: guideRevisionId,
    ...overrides,
  });
}
