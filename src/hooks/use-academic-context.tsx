import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { saveAcademicSelection } from "@/lib/api";
import type { AcademicSelection } from "@/lib/types";
import { useAuth } from "./use-auth";

const STORAGE_KEY = "academic-selection";

interface AcademicContextValue extends AcademicSelection {
  isComplete: boolean;
  isReady: boolean;
  setDepartment: (id: string | null) => void;
  setSemester: (id: string | null) => void;
  setSection: (id: string | null) => void;
  reset: () => void;
}

const empty: AcademicSelection = { departmentId: null, semesterId: null, sectionId: null };

const AcademicContext = createContext<AcademicContextValue | undefined>(undefined);

function readStored(): AcademicSelection {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...empty, ...(JSON.parse(raw) as AcademicSelection) } : empty;
  } catch {
    return empty;
  }
}

export function AcademicProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [selection, setSelection] = useState<AcademicSelection>(empty);
  const [isReady, setIsReady] = useState(false);

  // Hydrate from local storage after mount (avoids SSR mismatch).
  useEffect(() => {
    setSelection(readStored());
    setIsReady(true);
  }, []);

  // A saved profile selection wins over local storage.
  useEffect(() => {
    if (!profile?.section_id) return;
    setSelection({
      departmentId: profile.department_id,
      semesterId: profile.semester_id,
      sectionId: profile.section_id,
    });
  }, [profile?.department_id, profile?.semester_id, profile?.section_id]);

  const persist = useCallback(
    (next: AcademicSelection) => {
      setSelection(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      if (user && next.departmentId && next.semesterId && next.sectionId) {
        void saveAcademicSelection(user.id, {
          departmentId: next.departmentId,
          semesterId: next.semesterId,
          sectionId: next.sectionId,
        }).catch(() => undefined);
      }
    },
    [user],
  );

  const value = useMemo<AcademicContextValue>(
    () => ({
      ...selection,
      isReady,
      isComplete: Boolean(selection.departmentId && selection.semesterId && selection.sectionId),
      setDepartment: (id) => persist({ departmentId: id, semesterId: null, sectionId: null }),
      setSemester: (id) => persist({ ...selection, semesterId: id, sectionId: null }),
      setSection: (id) => persist({ ...selection, sectionId: id }),
      reset: () => persist(empty),
    }),
    [selection, isReady, persist],
  );

  return <AcademicContext.Provider value={value}>{children}</AcademicContext.Provider>;
}

export function useAcademicContext(): AcademicContextValue {
  const context = useContext(AcademicContext);
  if (!context) throw new Error("useAcademicContext must be used inside <AcademicProvider>");
  return context;
}
