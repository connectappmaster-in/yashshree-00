// Single source of truth for boards, classes, streams, and subject lists.
// Standardized full names — no abbreviations.

export const BOARDS = ["SSC", "CBSE", "ICSE", "IB"] as const;
export type Board = (typeof BOARDS)[number];

export const MEDIUMS_BY_BOARD: Record<Board, string[]> = {
  SSC: ["Marathi", "Semi English", "English"],
  CBSE: ["English"],
  ICSE: ["English"],
  IB: ["English"],
};

export const ALL_MEDIUMS = ["Marathi", "Semi English", "English"];

export const CLASS_OPTIONS = [
  "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th",
] as const;
export type ClassOption = (typeof CLASS_OPTIONS)[number];

export type Stream = "science" | "commerce" | "none";
export const STREAM_OPTIONS: { value: Stream; label: string }[] = [
  { value: "science", label: "Science" },
  { value: "commerce", label: "Commerce" },
];

// Subjects for 5th–10th (board-agnostic, standardized full names)
const SUBJECTS_5_TO_10: string[] = [
  "Marathi",
  "Hindi",
  "Sanskrit",
  "English",
  "Mathematics",
  "Science",
  "Social Science",
];

// 11th & 12th — Science stream
const SUBJECTS_11_12_SCIENCE: string[] = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "Biology",
  "English",
  "Information Technology",
  "Marathi",
  "Hindi",
];

// 11th & 12th — Commerce stream
const SUBJECTS_11_12_COMMERCE: string[] = [
  "Accountancy",
  "Economics",
  "Secretarial Practice",
  "Organisation of Commerce",
  "Mathematics",
  "English",
  "Information Technology",
  "Geography",
  "Marathi",
  "Hindi",
];

export function isHigherSecondary(cls: string): boolean {
  return cls === "11th" || cls === "12th";
}

export function getSubjectsFor(cls: string, stream: Stream): string[] {
  if (!isHigherSecondary(cls)) return SUBJECTS_5_TO_10;
  if (stream === "science") return SUBJECTS_11_12_SCIENCE;
  if (stream === "commerce") return SUBJECTS_11_12_COMMERCE;
  return [];
}

// Flat union of every subject the app may ever offer — useful for filters.
export const ALL_SUBJECTS: string[] = Array.from(
  new Set([...SUBJECTS_5_TO_10, ...SUBJECTS_11_12_SCIENCE, ...SUBJECTS_11_12_COMMERCE]),
);
