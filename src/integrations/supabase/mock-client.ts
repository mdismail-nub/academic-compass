import {
  MOCK_DEPARTMENTS,
  MOCK_SEMESTERS,
  MOCK_SECTIONS,
  MOCK_COURSES,
  MOCK_FACULTY,
  MOCK_ROOMS,
  MOCK_ROUTINE_ENTRIES,
  MOCK_NOTICES,
} from "./mock-data";

const tables: Record<string, Record<string, unknown>[]> = {
  departments: [...MOCK_DEPARTMENTS],
  semesters: [...MOCK_SEMESTERS],
  sections: [...MOCK_SECTIONS],
  courses: [...MOCK_COURSES],
  faculty: [...MOCK_FACULTY],
  rooms: [...MOCK_ROOMS],
  routine_entries: [...MOCK_ROUTINE_ENTRIES],
  academic_notices: [...MOCK_NOTICES],
  profiles: [],
  user_roles: [],
};

class MockQueryBuilder<T extends Record<string, unknown>> {
  private tableName: string;
  private currentData: T[];
  private filters: ((item: T) => boolean)[] = [];

  constructor(tableName: string) {
    this.tableName = tableName;
    const store = (tables[tableName] ?? []) as T[];
    this.currentData = [...store];
  }

  select(columns = "*", options?: { count?: "exact"; head?: boolean }) {
    if (options?.head) {
      const filtered = this.applyFilters();
      return Promise.resolve({ data: null, count: filtered.length, error: null });
    }
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((item) => item[column] === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((item) => item[column] !== value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((item) => values.includes(item[column]));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    const ascending = options?.ascending ?? true;
    this.currentData.sort((a, b) => {
      const valA = a[column];
      const valB = b[column];
      if (valA === valB) return 0;
      if (valA == null) return ascending ? -1 : 1;
      if (valB == null) return ascending ? 1 : -1;
      if (ascending) return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });
    return this;
  }

  private applyFilters(): T[] {
    let result = this.currentData;
    for (const filter of this.filters) {
      result = result.filter(filter);
    }
    return result;
  }

  async maybeSingle() {
    const filtered = this.applyFilters();
    return { data: filtered[0] ?? null, error: null };
  }

  async single() {
    const filtered = this.applyFilters();
    const item = filtered[0] ?? null;
    return { data: item, error: item ? null : { message: "No rows found" } };
  }

  async insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    const items = Array.isArray(values) ? values : [values];
    const store = (tables[this.tableName] ??= []);
    const inserted: Record<string, unknown>[] = [];

    for (const raw of items) {
      const id =
        (raw.id as string) || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date().toISOString();
      const item: Record<string, unknown> = {
        ...raw,
        id,
        created_at: raw.created_at || now,
        updated_at: raw.updated_at || now,
      };

      // Enrich routine entry joins if applicable
      if (this.tableName === "routine_entries") {
        const courses = tables.courses || [];
        const facultyList = tables.faculty || [];
        const rooms = tables.rooms || [];
        const sections = tables.sections || [];
        const semesters = tables.semesters || [];

        const course = courses.find((c) => c.id === item.course_id);
        const fac = facultyList.find((f) => f.id === item.faculty_id);
        const room = rooms.find((r) => r.id === item.room_id);
        const section = sections.find((s) => s.id === item.section_id);
        const semester = section ? semesters.find((sem) => sem.id === section.semester_id) : null;

        item.course = course
          ? {
              id: course.id,
              course_code: course.course_code,
              course_name: course.course_name,
              credit: course.credit,
            }
          : null;
        item.faculty = fac
          ? { id: fac.id, name: fac.name, short_name: fac.short_name, designation: fac.designation }
          : null;
        item.room = room
          ? { id: room.id, room_number: room.room_number, building: room.building }
          : null;
        item.section = section
          ? {
              id: section.id,
              name: section.name,
              semester: semester
                ? {
                    id: semester.id,
                    name: semester.name,
                    number: semester.number,
                    department_id: semester.department_id,
                  }
                : null,
            }
          : null;
      }

      store.push(item);
      inserted.push(item);
    }

    return { data: Array.isArray(values) ? inserted : inserted[0], error: null };
  }

  async update(values: Record<string, unknown>) {
    const store = (tables[this.tableName] ??= []);
    const matching = this.applyFilters();
    const updated: Record<string, unknown>[] = [];

    for (let i = 0; i < store.length; i++) {
      const current = store[i];
      if (matching.some((m) => m.id === current.id)) {
        const merged = { ...current, ...values, updated_at: new Date().toISOString() };

        if (this.tableName === "routine_entries") {
          const courses = tables.courses || [];
          const facultyList = tables.faculty || [];
          const rooms = tables.rooms || [];
          const sections = tables.sections || [];
          const semesters = tables.semesters || [];

          const course = courses.find((c) => c.id === merged.course_id);
          const fac = facultyList.find((f) => f.id === merged.faculty_id);
          const room = rooms.find((r) => r.id === merged.room_id);
          const section = sections.find((s) => s.id === merged.section_id);
          const semester = section ? semesters.find((sem) => sem.id === section.semester_id) : null;

          merged.course = course
            ? {
                id: course.id,
                course_code: course.course_code,
                course_name: course.course_name,
                credit: course.credit,
              }
            : null;
          merged.faculty = fac
            ? {
                id: fac.id,
                name: fac.name,
                short_name: fac.short_name,
                designation: fac.designation,
              }
            : null;
          merged.room = room
            ? { id: room.id, room_number: room.room_number, building: room.building }
            : null;
          merged.section = section
            ? {
                id: section.id,
                name: section.name,
                semester: semester
                  ? {
                      id: semester.id,
                      name: semester.name,
                      number: semester.number,
                      department_id: semester.department_id,
                    }
                  : null,
              }
            : null;
        }

        store[i] = merged;
        updated.push(merged);
      }
    }

    return { data: updated, error: null };
  }

  async delete() {
    const store = (tables[this.tableName] ??= []);
    const matching = this.applyFilters();

    tables[this.tableName] = store.filter((item) => !matching.some((m) => m.id === item.id));

    return { data: null, error: null };
  }

  then(resolve: (result: { data: T[]; count: number; error: null }) => unknown) {
    const filtered = this.applyFilters();
    return Promise.resolve({ data: filtered, count: filtered.length, error: null }).then(resolve);
  }
}

export function createMockSupabaseClient() {
  console.info(
    "[AI Studio] Supabase environment variables not detected — using in-memory mock client with academic routine data.",
  );

  return {
    from: (table: string) => new MockQueryBuilder(table),
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: (_callback: unknown) => ({
        data: {
          subscription: {
            id: "mock-sub",
            callback: _callback,
            unsubscribe: () => {},
          },
        },
      }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({
        data: { session: null, user: null },
        error: { message: "Supabase not configured. Connect your Supabase project in Settings." },
      }),
      signUp: async () => ({
        data: { session: null, user: null },
        error: { message: "Supabase not configured. Connect your Supabase project in Settings." },
      }),
      setSession: async () => ({ data: { session: null, user: null }, error: null }),
    },
  };
}
