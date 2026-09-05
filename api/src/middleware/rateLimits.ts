export const CREATE = { windowSeconds: 86_400, max: 20 } as const;
export const CONTRIBUTION = { windowSeconds: 3_600, max: 60 } as const;
export const MODERATION = { windowSeconds: 3_600, max: 30 } as const;
export const HEAVY = { windowSeconds: 3_600, max: 30 } as const;
export const DESTRUCTIVE = { windowSeconds: 3_600, max: 5 } as const;
export const DASHBOARD = { windowSeconds: 60, max: 10 } as const;
export const READ = { windowSeconds: 60, max: 600, keyBy: "ip" } as const;
export const SEARCH = { windowSeconds: 60, max: 30, keyBy: "ip" } as const;
