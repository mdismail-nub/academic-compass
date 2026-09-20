import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  AcademicNotice,
  AdminCounts,
  Course,
  Department,
  Faculty,
  Profile,
  Room,
  RoutineEntryDetailed,
  Section,
  Semester,
  UserRoleRow,
} from "./types";

/**
 * Central data-access layer. Components never talk to the database directly —
 * they consume the query options exported from this module.
 */

const ROUTINE_SELECT = `
  *,
  course:courses(id, course_code, course_name, credit),
  faculty:faculty(id, name, short_name, designation),
  room:rooms(id, room_number, building),
  section:sections(id, name, semester:semesters(id, name, number, department_id))
`;

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const queryKeys = {
  departments: ["departments"] as const,
  semesters: (departmentId?: string | null) => ["semesters", departmentId ?? null] as const,
  sections: (semesterId?: string | null) => ["sections", semesterId ?? null] as const,
  courses: (departmentId?: string | null) => ["courses", departmentId ?? null] as const,
  faculty: (departmentId?: string | null) => ["faculty", departmentId ?? null] as const,
  rooms: ["rooms"] as const,
  routineBySection: (sectionId?: string | null) => ["routine", "section", sectionId ?? null] as const,
  notices: ["notices"] as const,
  profile: (userId?: string | null) => ["profile", userId ?? null] as const,
  roles: (userId?: string | null) => ["roles", userId ?? null] as const,
  adminCounts: ["admin", "counts"] as const,
};

export const departmentsQuery = () =>
  queryOptions({
    queryKey: queryKeys.departments,
    queryFn: async (): Promise<Department[]> => {
      const { data, error } = await supabase.from("departments").select("*").order("code");
      return unwrap(data, error);
    },
  });

export const semestersQuery = (departmentId: string | null) =>
  queryOptions({
    queryKey: queryKeys.semesters(departmentId),
    enabled: Boolean(departmentId),
    queryFn: async (): Promise<Semester[]> => {
      const { data, error } = await supabase
        .from("semesters")
        .select("*")
        .eq("department_id", departmentId!)
        .order("number");
      return unwrap(data, error);
    },
  });

export const sectionsQuery = (semesterId: string | null) =>
  queryOptions({
    queryKey: queryKeys.sections(semesterId),
    enabled: Boolean(semesterId),
    queryFn: async (): Promise<Section[]> => {
      const { data, error } = await supabase
        .from("sections")
        .select("*")
        .eq("semester_id", semesterId!)
        .order("name");
      return unwrap(data, error);
    },
  });

export const coursesQuery = (departmentId?: string | null) =>
  queryOptions({
    queryKey: queryKeys.courses(departmentId),
    queryFn: async (): Promise<Course[]> => {
      let q = supabase.from("courses").select("*").order("course_code");
      if (departmentId) q = q.eq("department_id", departmentId);
      const { data, error } = await q;
      return unwrap(data, error);
    },
  });

export const facultyQuery = (departmentId?: string | null) =>
  queryOptions({
    queryKey: queryKeys.faculty(departmentId),
    queryFn: async (): Promise<Faculty[]> => {
      let q = supabase.from("faculty").select("*").order("name");
      if (departmentId) q = q.eq("department_id", departmentId);
      const { data, error } = await q;
      return unwrap(data, error);
    },
  });

export const roomsQuery = () =>
  queryOptions({
    queryKey: queryKeys.rooms,
    queryFn: async (): Promise<Room[]> => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("building")
        .order("room_number");
      return unwrap(data, error);
    },
  });

export const routineBySectionQuery = (sectionId: string | null) =>
  queryOptions({
    queryKey: queryKeys.routineBySection(sectionId),
    enabled: Boolean(sectionId),
    queryFn: async (): Promise<RoutineEntryDetailed[]> => {
      const { data, error } = await supabase
        .from("routine_entries")
        .select(ROUTINE_SELECT)
        .eq("section_id", sectionId!)
        .order("day_of_week")
        .order("start_time");
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as RoutineEntryDetailed[];
    },
  });

export const noticesQuery = () =>
  queryOptions({
    queryKey: queryKeys.notices,
    queryFn: async (): Promise<AcademicNotice[]> => {
      const { data, error } = await supabase
        .from("academic_notices")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false });
      return unwrap(data, error);
    },
  });

export const profileQuery = (userId: string | null) =>
  queryOptions({
    queryKey: queryKeys.profile(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const rolesQuery = (userId: string | null) =>
  queryOptions({
    queryKey: queryKeys.roles(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<UserRoleRow[]> => {
      const { data, error } = await supabase.from("user_roles").select("*").eq("user_id", userId!);
      return unwrap(data, error);
    },
  });

export const adminCountsQuery = () =>
  queryOptions({
    queryKey: queryKeys.adminCounts,
    queryFn: async (): Promise<AdminCounts> => {
      const count = async (table: Parameters<typeof supabase.from>[0]) => {
        const { count: value, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        if (error) throw new Error(error.message);
        return value ?? 0;
      };
      const [departments, sections, courses, faculty, rooms, routineEntries, notices] =
        await Promise.all([
          count("departments"),
          count("sections"),
          count("courses"),
          count("faculty"),
          count("rooms"),
          count("routine_entries"),
          count("academic_notices"),
        ]);
      return { departments, sections, courses, faculty, rooms, routineEntries, notices };
    },
  });

/** Persist the student's department/semester/section choice on their profile. */
export async function saveAcademicSelection(
  userId: string,
  selection: { departmentId: string; semesterId: string; sectionId: string },
) {
  const { error } = await supabase
    .from("profiles")
    .update({
      department_id: selection.departmentId,
      semester_id: selection.semesterId,
      section_id: selection.sectionId,
    })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}
