# Academic Compass

I want to build a production-quality university academic companion web application.



IMPORTANT: Do NOT try to build every feature at once. This is Phase 1. First understand the requirements, establish a scalable architecture and database structure, and build the foundation correctly. We will implement the remaining features in later prompts.



PROJECT CONCEPT



The application will allow university students to select their:



- Department

- Semester

- Section



and then access their complete academic routine.



The platform will eventually provide:



1. Student routine

2. Today's classes

3. Weekly routine

4. Faculty information

5. Course information

6. Free room finder

7. Academic notices

8. Exam schedules

9. Academic calendar

10. Search

11. Admin dashboard

12. Routine management

13. Faculty/course/room management

14. CSV import for routine data

15. Routine conflict detection

16. Eventually an AI-powered academic assistant



The application should be designed so that these features can be added without restructuring the database later.



---



PHASE 1 OBJECTIVE



For this phase, focus on:



1. Project architecture

2. Database schema

3. Supabase integration

4. Authentication foundation

5. Student/admin role structure

6. Basic responsive application shell

7. Initial navigation

8. Basic dashboard placeholders

9. Proper TypeScript types

10. Scalable and maintainable code structure



Do not implement the AI assistant, advanced notifications, exam management, or other future features yet.



---



TECH STACK



Use:



- React

- TypeScript

- Vite

- Tailwind CSS

- shadcn/ui where appropriate

- Supabase

- PostgreSQL

- Supabase Authentication

- Supabase Storage where needed later



Keep the application suitable for deployment on Vercel.



Use clean, reusable components instead of putting everything into a single large component.



---



DATABASE ARCHITECTURE



Design the database around relational data rather than storing routine information as images or hardcoded frontend objects.



Create the following core tables.



departments



Fields:



- id

- name

- code

- created_at

- updated_at



Example:



CSE — Computer Science and Engineering



The system must support multiple departments even though the initial data may only contain CSE.



---



semesters



Fields:



- id

- department_id

- name

- number

- created_at

- updated_at



A semester belongs to a department.



---



sections



Fields:



- id

- semester_id

- name

- created_at

- updated_at



Example:



Section A

Section B

Section C



---



courses



Fields:



- id

- department_id

- course_code

- course_name

- credit

- description

- created_at

- updated_at



Course code must be unique within the appropriate scope.



---



faculty



Fields:



- id

- name

- short_name

- designation

- department_id

- email

- phone

- office

- photo_url

- bio

- created_at

- updated_at



Not every field needs to be mandatory.



---



rooms



Fields:



- id

- room_number

- building

- floor

- capacity

- room_type

- created_at

- updated_at



Room number should be unique within a building.



---



routine_entries



This is the core table.



Fields:



- id

- section_id

- course_id

- faculty_id

- room_id

- day_of_week

- start_time

- end_time

- created_at

- updated_at



The routine must reference the actual course, faculty, room and section records through foreign keys.



Do NOT store course names, faculty names and room names repeatedly as plain text if a relational reference can be used.



---



academic_notices



Fields:



- id

- title

- description

- notice_type

- published_at

- expires_at

- attachment_url

- is_pinned

- created_at

- updated_at



---



USER / AUTHENTICATION FOUNDATION



Set up Supabase authentication.



There will eventually be two primary roles:



Student



Can:



- View routines

- View faculty

- View courses

- Find free rooms

- Read notices



Admin



Can:



- Manage routine

- Manage departments

- Manage semesters

- Manage sections

- Manage courses

- Manage faculty

- Manage rooms

- Manage notices



Create the architecture for role-based access control.



Do not allow normal students to access admin management functionality.



Use secure Supabase Row Level Security policies rather than relying only on frontend route protection.



---



DATABASE RELATIONSHIPS



Establish proper foreign-key relationships:



Department

→ Semesters

→ Sections

→ Routine Entries



Department

→ Courses



Department

→ Faculty



Routine Entry

→ Section

→ Course

→ Faculty

→ Room



Make sure deletes and updates use sensible foreign-key behavior.



Avoid unnecessary cascading deletes that could accidentally remove large amounts of academic data.



---



ROUTINE DESIGN



The routine must be stored as structured data.



For example:



Section C

Sunday

09:30–10:50

CSE2215

Faculty JRZ

Room 415



This should be represented through database relationships rather than as an image.



The system should eventually be able to answer queries such as:



- What classes does Section C have today?

- What classes does Section C have tomorrow?

- Which room is being used at a particular time?

- Which faculty is teaching at a particular time?

- Which rooms are free at a particular time?

- What classes does a particular faculty member teach?



Design the schema so these queries will be efficient.



---



INITIAL APPLICATION STRUCTURE



Create a polished but restrained university-focused UI.



Do NOT make it look like a generic SaaS dashboard.



The design should feel:



- Clean

- Academic

- Modern

- Professional

- Fast

- Mobile-first

- Easy to understand

- Minimal but not boring



Use a white/light interface with blue as the primary accent.



Avoid excessive gradients, excessive animations, huge decorative elements, and unnecessary glassmorphism.



The interface should work particularly well on Android/mobile screens.



---



INITIAL ROUTES



Create the basic route structure:



/



Landing page



/login



Authentication



/dashboard



Student dashboard



/routine



Weekly routine



/faculty



Faculty directory



/rooms



Room finder



/notices



Academic notices



/admin



Admin dashboard



/admin/routine



/admin/faculty



/admin/courses



/admin/rooms



/admin/sections



/admin/notices



These admin pages can initially contain well-designed placeholders where functionality is not implemented yet.



---



LANDING PAGE



Create an initial landing page explaining the platform.



Possible messaging:



"Your University, Organized."



Supporting text:



"Access your routine, faculty information, rooms, academic notices and more — all in one place."



Include a clear CTA:



"View My Routine"



Do not make the landing page overly marketing-heavy.



The actual application should be the main focus.



---



STUDENT DASHBOARD FOUNDATION



Create a dashboard that will eventually show:



- Selected department

- Selected semester

- Selected section

- Today's classes

- Next class

- Quick access to full routine

- Faculty

- Free rooms

- Notices



For now, build the UI and data-loading architecture cleanly.



If no section has been selected, show an onboarding state asking the student to select:



Department → Semester → Section



Store the selected context appropriately so the user does not need to repeatedly select it during the same session.



---



ADMIN DASHBOARD FOUNDATION



Create an admin dashboard with summary cards:



- Departments

- Sections

- Courses

- Faculty

- Rooms

- Routine entries

- Notices



The numbers should eventually come from Supabase.



For this phase, establish the structure and data-fetching pattern.



---



COMPONENT ARCHITECTURE



Create reusable components such as:



- Navbar

- Sidebar

- Mobile navigation

- Page header

- Section selector

- Department selector

- Semester selector

- Loading state

- Empty state

- Error state

- Data table

- Confirmation dialog

- Dashboard card

- Routine card



Avoid duplicated UI logic.



---



TYPES



Create proper TypeScript types/interfaces for:



- Department

- Semester

- Section

- Course

- Faculty

- Room

- RoutineEntry

- AcademicNotice

- User/Profile



Use generated Supabase database types if practical.



Avoid using "any" unless absolutely necessary.



---



SECURITY



Security is important.



Implement:



- Supabase Row Level Security

- Protected admin routes

- Role-based permissions

- Secure authentication state handling

- No service-role keys in frontend code

- Environment variables for sensitive configuration



Never expose Supabase service-role credentials in the client.



---



DATA VALIDATION



Prepare the architecture for validation of:



- Invalid time ranges

- Duplicate routine entries

- Faculty conflicts

- Room conflicts

- Section conflicts



Full conflict detection can be implemented in a later phase, but the database and code should make it possible.



---



IMPORTANT DEVELOPMENT RULES



1. Do not hardcode the university routine into React components.

2. Do not create fake routine data that looks like real data and leave it mixed into production logic.

3. Do not create separate unrelated databases for each feature.

4. Do not duplicate faculty/course/room information inside routine entries.

5. Keep database logic separate from presentation components.

6. Keep reusable components modular.

7. Use proper loading, empty and error states.

8. Make the UI responsive from the beginning.

9. Do not over-engineer features that are not part of Phase 1.

10. Do not implement AI functionality yet.



---



FUTURE ARCHITECTURE



Keep the architecture ready for future modules:



- Exam routine

- Academic calendar

- Holidays

- Attendance

- GPA calculator

- Assignments

- Personal timetable

- Push notifications

- AI academic assistant

- Natural language routine search



These should be possible without redesigning the core routine database.



---



BEFORE CODING



First inspect and reason about the complete architecture.



Then:



1. Create the database schema.

2. Create the required Supabase tables and relationships.

3. Configure authentication foundation.

4. Configure RLS policies.

5. Create TypeScript types.

6. Build the initial application shell.

7. Build the initial routes.

8. Build the student and admin dashboard foundations.

9. Make sure the project runs without TypeScript/build errors.



Do NOT move on to advanced features yet.



At the end, give me a concise summary of:



- What was created

- Database tables

- Relationships

- Authentication setup

- Routes

- What remains for Phase 2

- Any configuration or environment variables I need to provide



Most importantly: prioritize a solid backend/data architecture over adding lots of visual features in this first phase.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1ae3db1f-22ef-46b7-8d48-47c0b9d8419c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
