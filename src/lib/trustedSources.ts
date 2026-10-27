export type SubjectCategory =
  "math" | "programming" | "physics" | "chemistry" | "biology" | "history" | "geography" | "other";

export const TRUSTED_DOMAINS: Record<SubjectCategory, string[]> = {
  math: ["openstax.org", "khanacademy.org"],
  programming: [
    "developer.mozilla.org",
    "docs.python.org",
    "react.dev",
    "learn.microsoft.com",
    "docs.oracle.com",
  ],
  physics: ["openstax.org", "khanacademy.org"],
  chemistry: ["openstax.org", "iupac.org"],
  biology: ["openstax.org", "nih.gov", "khanacademy.org"],
  history: ["britannica.com"],
  geography: ["nationalgeographic.com", "britannica.com"],
  other: [],
};
