
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TYPE public.app_role AS ENUM ('admin', 'student');

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  name text NOT NULL,
  number smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, number)
);
CREATE INDEX idx_semesters_department ON public.semesters(department_id);

CREATE TABLE public.sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semesters(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (semester_id, name)
);
CREATE INDEX idx_sections_semester ON public.sections(semester_id);

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  course_code text NOT NULL,
  course_name text NOT NULL,
  credit numeric(3,1) NOT NULL DEFAULT 3.0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, course_code)
);
CREATE INDEX idx_courses_department ON public.courses(department_id);

CREATE TABLE public.faculty (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text,
  designation text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL ON UPDATE CASCADE,
  email text,
  phone text,
  office text,
  photo_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_faculty_department ON public.faculty(department_id);
CREATE UNIQUE INDEX idx_faculty_short_name ON public.faculty(lower(short_name)) WHERE short_name IS NOT NULL;

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number text NOT NULL,
  building text NOT NULL DEFAULT 'Main',
  floor smallint,
  capacity integer,
  room_type text NOT NULL DEFAULT 'theory',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building, room_number)
);

CREATE TABLE public.routine_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE ON UPDATE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  faculty_id uuid REFERENCES public.faculty(id) ON DELETE SET NULL ON UPDATE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL ON UPDATE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT routine_time_valid CHECK (end_time > start_time)
);
CREATE INDEX idx_routine_section_day ON public.routine_entries(section_id, day_of_week, start_time);
CREATE INDEX idx_routine_faculty_day ON public.routine_entries(faculty_id, day_of_week, start_time);
CREATE INDEX idx_routine_room_day ON public.routine_entries(room_id, day_of_week, start_time);
CREATE INDEX idx_routine_course ON public.routine_entries(course_id);

ALTER TABLE public.routine_entries
  ADD CONSTRAINT routine_no_section_overlap EXCLUDE USING gist (
    section_id WITH =, day_of_week WITH =,
    numrange(EXTRACT(EPOCH FROM start_time)::numeric, EXTRACT(EPOCH FROM end_time)::numeric) WITH &&
  );
ALTER TABLE public.routine_entries
  ADD CONSTRAINT routine_no_room_overlap EXCLUDE USING gist (
    room_id WITH =, day_of_week WITH =,
    numrange(EXTRACT(EPOCH FROM start_time)::numeric, EXTRACT(EPOCH FROM end_time)::numeric) WITH &&
  ) WHERE (room_id IS NOT NULL);
ALTER TABLE public.routine_entries
  ADD CONSTRAINT routine_no_faculty_overlap EXCLUDE USING gist (
    faculty_id WITH =, day_of_week WITH =,
    numrange(EXTRACT(EPOCH FROM start_time)::numeric, EXTRACT(EPOCH FROM end_time)::numeric) WITH &&
  ) WHERE (faculty_id IS NOT NULL);

CREATE TABLE public.academic_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  notice_type text NOT NULL DEFAULT 'general',
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  attachment_url text,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notices_published ON public.academic_notices(published_at DESC);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  student_id text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  semester_id uuid REFERENCES public.semesters(id) ON DELETE SET NULL,
  section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_semesters_updated BEFORE UPDATE ON public.semesters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sections_updated BEFORE UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_faculty_updated BEFORE UPDATE ON public.faculty FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_rooms_updated BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_routine_updated BEFORE UPDATE ON public.routine_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_notices_updated BEFORE UPDATE ON public.academic_notices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.departments, public.semesters, public.sections, public.courses, public.faculty, public.rooms, public.routine_entries, public.academic_notices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments, public.semesters, public.sections, public.courses, public.faculty, public.rooms, public.routine_entries, public.academic_notices TO authenticated;
GRANT ALL ON public.departments, public.semesters, public.sections, public.courses, public.faculty, public.rooms, public.routine_entries, public.academic_notices TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "departments_read" ON public.departments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "departments_admin" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "semesters_read" ON public.semesters FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "semesters_admin" ON public.semesters FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "sections_read" ON public.sections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sections_admin" ON public.sections FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "courses_read" ON public.courses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "courses_admin" ON public.courses FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "faculty_read" ON public.faculty FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "faculty_admin" ON public.faculty FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "rooms_read" ON public.rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "rooms_admin" ON public.rooms FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "routine_read" ON public.routine_entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "routine_admin" ON public.routine_entries FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "notices_read" ON public.academic_notices FOR SELECT TO anon, authenticated USING (published_at <= now() AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY "notices_admin" ON public.academic_notices FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
