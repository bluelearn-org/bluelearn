export const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

export type ProfileAPI = {
  username: string;
  display_name: string | null;
  created_at: string;
};

export type ProfileRole = string;

export type ProfileActivityRow = {
  type: string;
  title: string;
  change_summary: string;
  date: string;
  status: string;
  review_case: string;
};

export type ProfileStats = {
  upvotes?: number;
  downvotes?: number;
  contributions?: number;
  reviews?: number;
};

export type ProfilePageData = {
  profile: ProfileAPI;
  roles: Array<ProfileRole>;
  stats?: ProfileStats;
  activity?: Array<ProfileActivityRow>;
};

const FALLBACK_PROFILE_DATA: ProfilePageData = {
  profile: {
    username: "demo_user",
    display_name: "Demo User",
    created_at: new Date().toISOString(),
  },
  roles: ["Admin"],
  stats: {
    upvotes: 27,
    downvotes: 3,
    contributions: 12,
    reviews: 8,
  },
  activity: [
    {
      type: "Guide creation",
      title: "How to guide title here",
      change_summary: "Drafted a new learning guide",
      date: "07-12-2026",
      status: "In review",
      review_case: "View case",
    },
    {
      type: "Objective revision",
      title: "Objective title here",
      change_summary: "Updated the learning objective summary",
      date: "07-11-2026",
      status: "Approved",
      review_case: "View case",
    },
    {
      type: "Guide creation",
      title: "How to guide title here",
      change_summary: "Added a new variant for the content",
      date: "07-10-2026",
      status: "Pending",
      review_case: "View case",
    },
    {
      type: "Variant revision",
      title: "How to guide title here",
      change_summary: "Added a new variant for the content",
      date: "07-10-2026",
      status: "Pending",
      review_case: "View case",
    },
    {
      type: "Objective creation",
      title: "How to guide title here",
      change_summary: "Added a new variant for the content",
      date: "07-10-2026",
      status: "Pending",
      review_case: "View case",
    },
    {
      type: "Objective revision",
      title: "How to guide title here",
      change_summary: "Added a new variant for the content",
      date: "07-10-2026",
      status: "Pending",
      review_case: "View case",
    },
  ],
};

export async function fetchMyProfile(): Promise<ProfilePageData> {
  try {
    const response = await fetch(`${apiBase}/me`);
    if (!response.ok) {
      throw new Error(`Failed to load profile: ${response.statusText}`);
    }

    const data = (await response.json()) as Partial<ProfilePageData>;

    return {
      profile: data.profile ?? FALLBACK_PROFILE_DATA.profile,
      roles: data.roles ?? FALLBACK_PROFILE_DATA.roles,
      stats: data.stats ?? FALLBACK_PROFILE_DATA.stats,
      activity: data.activity ?? FALLBACK_PROFILE_DATA.activity,
    };
  } catch {
    return FALLBACK_PROFILE_DATA;
  }
}
