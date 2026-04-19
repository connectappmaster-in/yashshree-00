import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export const ACADEMIC_YEARS = ["2026-27", "2025-26", "2024-25"];
const STORAGE_KEY = "ysc_academic_year";

interface AcademicYearContextValue {
  year: string;
  setYear: (year: string) => void;
}

const AcademicYearContext = createContext<AcademicYearContextValue | null>(null);

export function AcademicYearProvider({ children }: { children: ReactNode }) {
  // Default to today's academic year (April–March cycle), fallback to first listed
  const initial = (() => {
    const derived = deriveAcademicYear(new Date());
    return ACADEMIC_YEARS.includes(derived) ? derived : ACADEMIC_YEARS[0];
  })();
  const [year, setYearState] = useState<string>(initial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ACADEMIC_YEARS.includes(stored)) setYearState(stored);
  }, []);

  const setYear = (y: string) => {
    setYearState(y);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, y);
  };

  return (
    <AcademicYearContext.Provider value={{ year, setYear }}>
      {children}
    </AcademicYearContext.Provider>
  );
}

export function useAcademicYear() {
  const ctx = useContext(AcademicYearContext);
  if (!ctx) throw new Error("useAcademicYear must be used within AcademicYearProvider");
  return ctx;
}

/** Auto-derive academic year from a date (April-March cycle). */
export function deriveAcademicYear(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const month = d.getMonth(); // 0-11
  const year = d.getFullYear();
  // April (3) onwards is start of new academic year
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}
