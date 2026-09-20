import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

export type Department = Tables["departments"]["Row"];
export type Semester = Tables["semesters"]["Row"];
export type Section = Tables["sections"]["Row"];
export type Course = Tables["courses"]["Row"];
export type Faculty = Tables["faculty"]["Row"];
export type Room = Tables["rooms"]["Row"];
export type RoutineEntry = Tables["routine_entries"]["Row"];
export type AcademicNotice = Tables["academic_notices"]["Row"];
export type Profile = Tables["profiles"]["Row"];
export type UserRoleRow = Tables["user_roles"]["Row"];

export type DepartmentInsert = Tables["departments"]["Insert"];
export type SemesterInsert = Tables["semesters"]["Insert"];
export type SectionInsert = Tables["sections"]["Insert"];
export type CourseInsert = Tables["courses"]["Insert"];
export type FacultyInsert = Tables["faculty"]["Insert"];
export type RoomInsert = Tables["rooms"]["Insert"];
export type RoutineEntryInsert = Tables["routine_entries"]["Insert"];
export type AcademicNoticeInsert = Tables["academic_notices"]["Insert"];

export type AppRole = Database["public"]["Enums"]["app_role"];

/** A routine entry joined with the records it references. */
export type RoutineEntryDetailed = RoutineEntry & {
  course: Pick<Course, "id" | "course_code" | "course_name" | "credit"> | null;
  faculty: Pick<Faculty, "id" | "name" | "short_name" | "designation"> | null;
  room: Pick<Room, "id" | "room_number" | "building"> | null;
  section:
    | (Pick<Section, "id" | "name"> & {
        semester: Pick<Semester, "id" | "name" | "number" | "department_id"> | null;
      })
    | null;
};

/** The department -> semester -> section context a student is studying in. */
export interface AcademicSelection {
  departmentId: string | null;
  semesterId: string | null;
  sectionId: string | null;
}

export interface AdminCounts {
  departments: number;
  sections: number;
  courses: number;
  faculty: number;
  rooms: number;
  routineEntries: number;
  notices: number;
}
