export const DEPARTMENTS = ["acquisitions", "operations", "ir", "executive"] as const;
export type Department = (typeof DEPARTMENTS)[number];
