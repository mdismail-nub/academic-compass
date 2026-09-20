import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  BookOpen,
  Users,
  DoorOpen,
  Bell,
  GraduationCap,
  Search,
  Building,
  Mail,
  Phone,
  ArrowRight,
  RefreshCw,
  LayoutDashboard,
  Shield,
  Layers,
  MapPin,
  Check,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { useAcademicContext } from "@/hooks/use-academic-context";
import {
  departmentsQuery,
  semestersQuery,
  sectionsQuery,
  coursesQuery,
  facultyQuery,
  roomsQuery,
  routineBySectionQuery,
  noticesQuery,
  adminCountsQuery,
} from "@/lib/api";
import type { Department, Semester, Section, RoutineEntryDetailed } from "@/lib/types";
import { parseTimeToMinutes } from "@/lib/routine-conflicts";
import { RoutineManagement } from "@/components/admin/RoutineManagement";
import { CsvRoutineImport } from "@/components/admin/CsvRoutineImport";

export const Route = createFileRoute("/")({
  component: AcademicCompassApp,
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0] ?? "0", 10);
  const minutes = parts[1] ?? "00";
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
}

function AcademicCompassApp() {
  const {
    departmentId,
    semesterId,
    sectionId,
    isComplete,
    setDepartment,
    setSemester,
    setSection,
    reset,
  } = useAcademicContext();

  const [activeTab, setActiveTab] = useState<
    "routine" | "faculty" | "courses" | "rooms" | "notices" | "admin"
  >("routine");
  const [adminSubTab, setAdminSubTab] = useState<"routine" | "csv" | "overview">("routine");
  const [selectedDay, setSelectedDay] = useState<number>(() => new Date().getDay()); // Default to today
  const [facultySearch, setFacultySearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [roomFilter, setRoomFilter] = useState("all");

  // Queries
  const { data: departments = [] } = useQuery(departmentsQuery());
  const { data: semesters = [] } = useQuery(semestersQuery(departmentId));
  const { data: sections = [] } = useQuery(sectionsQuery(semesterId));
  const { data: routineEntries = [], isLoading: isRoutineLoading } = useQuery(
    routineBySectionQuery(sectionId),
  );
  const { data: facultyList = [] } = useQuery(facultyQuery(departmentId));
  const { data: coursesList = [] } = useQuery(coursesQuery(departmentId));
  const { data: roomsList = [] } = useQuery(roomsQuery());
  const { data: noticesList = [] } = useQuery(noticesQuery());
  const { data: adminCounts } = useQuery(adminCountsQuery());

  const selectedDepartment = departments.find((d) => d.id === departmentId);
  const selectedSemester = semesters.find((s) => s.id === semesterId);
  const selectedSection = sections.find((s) => s.id === sectionId);

  // Group routine by day
  const routineByDay = routineEntries.filter((entry) => entry.day_of_week === selectedDay);

  // Live status calculations for student dashboard
  const todayDayIdx = new Date().getDay();
  const now = new Date();
  const currentMinsNow = now.getHours() * 60 + now.getMinutes();

  const todayClasses = useMemo(() => {
    return routineEntries
      .filter((e) => e.day_of_week === todayDayIdx)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [routineEntries, todayDayIdx]);

  const currentClass = useMemo(() => {
    return todayClasses.find((e) => {
      const s = parseTimeToMinutes(e.start_time);
      const end = parseTimeToMinutes(e.end_time);
      return currentMinsNow >= s && currentMinsNow < end;
    });
  }, [todayClasses, currentMinsNow]);

  const nextClass = useMemo(() => {
    return todayClasses.find((e) => {
      const s = parseTimeToMinutes(e.start_time);
      return s > currentMinsNow;
    });
  }, [todayClasses, currentMinsNow]);

  // Quick preset helper
  const handleQuickDemoSetup = () => {
    setDepartment("dept-cse");
    setSemester("sem-cse-4");
    setSection("sec-cse-4c");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Academic Navigation */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-slate-900">
                  Academic Compass
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  Phase 1
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                University Academic Routine & Campus Companion
              </p>
            </div>
          </div>

          {/* Academic Context Badges / Selector */}
          <div className="flex items-center gap-2">
            {isComplete ? (
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-xs flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="font-semibold text-blue-700">
                    {selectedDepartment?.code ?? "CSE"}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span>{selectedSemester?.name ?? "4th Sem"}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-emerald-700 font-semibold">
                    {selectedSection?.name ?? "Sec C"}
                  </span>
                </div>
                <button
                  onClick={reset}
                  title="Change Department / Section"
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleQuickDemoSetup}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-700 text-white hover:bg-blue-800 transition-colors shadow-xs"
              >
                <span>Load CSE Demo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => setActiveTab("admin")}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                activeTab === "admin"
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Admin Portal</span>
              <span className="sm:hidden">Admin</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        {(isComplete || activeTab === "admin") && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100">
            <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2">
              <button
                onClick={() => setActiveTab("routine")}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === "routine"
                    ? "bg-blue-50 text-blue-700 border border-blue-200/80 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Class Routine</span>
              </button>

              <button
                onClick={() => setActiveTab("faculty")}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === "faculty"
                    ? "bg-blue-50 text-blue-700 border border-blue-200/80 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Faculty Directory</span>
              </button>

              <button
                onClick={() => setActiveTab("courses")}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === "courses"
                    ? "bg-blue-50 text-blue-700 border border-blue-200/80 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Courses</span>
              </button>

              <button
                onClick={() => setActiveTab("rooms")}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === "rooms"
                    ? "bg-blue-50 text-blue-700 border border-blue-200/80 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <DoorOpen className="w-4 h-4" />
                <span>Rooms & Finder</span>
              </button>

              <button
                onClick={() => setActiveTab("notices")}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === "notices"
                    ? "bg-blue-50 text-blue-700 border border-blue-200/80 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <Bell className="w-4 h-4" />
                <span>Notices</span>
                {noticesList.length > 0 && (
                  <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-full">
                    {noticesList.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("admin")}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === "admin"
                    ? "bg-slate-900 text-white font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <Shield className="w-4 h-4 text-blue-400" />
                <span>Admin Manager</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === "admin" ? (
          <div className="space-y-6">
            {/* Admin Header & Sub-Navigation */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                  <Shield className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-900">Academic Administration</h1>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      Live CRUD & Import
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage schedules, prevent room/faculty overlaps, and import bulk CSV data
                  </p>
                </div>
              </div>

              {/* Subtab Navigation Pills */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs font-semibold">
                <button
                  onClick={() => setAdminSubTab("routine")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    adminSubTab === "routine"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Routine Manager</span>
                </button>
                <button
                  onClick={() => setAdminSubTab("csv")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    adminSubTab === "csv"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>CSV Import</span>
                </button>
                <button
                  onClick={() => setAdminSubTab("overview")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    adminSubTab === "overview"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Overview & Stats</span>
                </button>
              </div>
            </div>

            {/* Subtab Content */}
            {adminSubTab === "routine" && (
              <RoutineManagement onOpenCsvImport={() => setAdminSubTab("csv")} />
            )}

            {adminSubTab === "csv" && (
              <CsvRoutineImport onBackToManager={() => setAdminSubTab("routine")} />
            )}

            {adminSubTab === "overview" && (
              <div className="space-y-6">
                {/* Summary Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <MetricCard
                    title="Departments"
                    count={adminCounts?.departments ?? departments.length}
                    icon={Building}
                  />
                  <MetricCard
                    title="Sections"
                    count={adminCounts?.sections ?? sections.length}
                    icon={Layers}
                  />
                  <MetricCard
                    title="Courses"
                    count={adminCounts?.courses ?? coursesList.length}
                    icon={BookOpen}
                  />
                  <MetricCard
                    title="Faculty"
                    count={adminCounts?.faculty ?? facultyList.length}
                    icon={Users}
                  />
                  <MetricCard
                    title="Rooms"
                    count={adminCounts?.rooms ?? roomsList.length}
                    icon={DoorOpen}
                  />
                  <MetricCard
                    title="Routine Entries"
                    count={adminCounts?.routineEntries ?? routineEntries.length}
                    icon={Calendar}
                  />
                  <MetricCard
                    title="Notices"
                    count={adminCounts?.notices ?? noticesList.length}
                    icon={Bell}
                  />
                  <MetricCard
                    title="Conflict Engine"
                    count={1}
                    icon={Shield}
                    customLabel="Active"
                  />
                </div>

                {/* Admin Quick Action Banners */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => setAdminSubTab("routine")}
                    className="p-5 rounded-2xl bg-linear-to-br from-blue-50 to-indigo-50 border border-blue-200/80 cursor-pointer hover:border-blue-300 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-blue-600 text-white rounded-xl">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Interactive Routine Manager
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Filter schedule by department, semester, and section. Add new slots, update
                      room allocations, or delete entries with real-time overlap conflict
                      prevention.
                    </p>
                  </div>

                  <div
                    onClick={() => setAdminSubTab("csv")}
                    className="p-5 rounded-2xl bg-linear-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 cursor-pointer hover:border-emerald-300 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-emerald-600 text-white rounded-xl">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">Bulk CSV Routine Import</h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Upload entire semester schedules from spreadsheets. Resolves course codes,
                      faculty designations, and room numbers with pre-flight batch conflict checks.
                    </p>
                  </div>
                </div>

                {/* Architecture Checklist */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200">
                  <h3 className="text-base font-bold text-slate-900 mb-4">
                    Academic Compass Architecture Status
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <StatusItem text="Relational PostgreSQL Schema Implemented" done />
                    <StatusItem
                      text="Foreign Key Consistency (Section → Course → Faculty → Room)"
                      done
                    />
                    <StatusItem
                      text="Row Level Security & Private Role Verification Function"
                      done
                    />
                    <StatusItem
                      text="Routine Exclusion Constraints for Room/Faculty Overlap"
                      done
                    />
                    <StatusItem text="Real-Time Schedule Conflict Pre-Flight Engine" done />
                    <StatusItem text="Admin Routine Management (Add, Edit, Delete, Filter)" done />
                    <StatusItem
                      text="Batch CSV Import with Entity Resolution & Overlap Checks"
                      done
                    />
                    <StatusItem text="Student Responsive Cards & Mobile Routine Timeline" done />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : !isComplete ? (
          <OnboardingSection
            departments={departments}
            semesters={semesters}
            sections={sections}
            departmentId={departmentId}
            semesterId={semesterId}
            sectionId={sectionId}
            onSelectDepartment={setDepartment}
            onSelectSemester={setSemester}
            onSelectSection={setSection}
            onQuickDemo={handleQuickDemoSetup}
          />
        ) : (
          <div>
            {/* ROUTINE VIEW */}
            {activeTab === "routine" && (
              <div className="space-y-6">
                {/* Live Campus Class Status Banner */}
                <div className="bg-linear-to-r from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-5 sm:p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2.5 w-2.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                          Live Academic Tracker • {DAYS[todayDayIdx]}
                        </span>
                      </div>
                      {currentClass ? (
                        <div>
                          <div className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                            <span>Happening Now: {currentClass.course?.course_code}</span>
                            <span className="text-xs font-normal px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Active
                            </span>
                          </div>
                          <p className="text-sm text-slate-300">
                            {currentClass.course?.course_name} in{" "}
                            <span className="font-semibold text-white">
                              Room {currentClass.room?.room_number} ({currentClass.room?.building})
                            </span>{" "}
                            with {currentClass.faculty?.name} until{" "}
                            {formatTime(currentClass.end_time)}
                          </p>
                        </div>
                      ) : nextClass ? (
                        <div>
                          <div className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                            <span>Next Class: {nextClass.course?.course_code}</span>
                            <span className="text-xs font-normal px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              Starts {formatTime(nextClass.start_time)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-300">
                            {nextClass.course?.course_name} in{" "}
                            <span className="font-semibold text-white">
                              Room {nextClass.room?.room_number}
                            </span>{" "}
                            with {nextClass.faculty?.name}
                          </p>
                        </div>
                      ) : todayClasses.length > 0 ? (
                        <div>
                          <div className="text-lg sm:text-xl font-bold text-white">
                            All classes for today completed
                          </div>
                          <p className="text-sm text-slate-300">
                            You have completed all {todayClasses.length} classes scheduled for{" "}
                            {DAYS[todayDayIdx]}.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div className="text-lg sm:text-xl font-bold text-white">
                            No classes scheduled today ({DAYS[todayDayIdx]})
                          </div>
                          <p className="text-sm text-slate-300">
                            Enjoy your day off or review upcoming schedules using the week selector
                            below.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Quick navigation actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setActiveTab("rooms")}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-xs"
                      >
                        <DoorOpen className="w-3.5 h-3.5 text-blue-300" />
                        <span>Find Free Rooms</span>
                      </button>
                      <button
                        onClick={() => setActiveTab("faculty")}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-xs"
                      >
                        <Users className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Faculty Info</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Routine Day Selector and Info */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                      Weekly Class Schedule
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      {selectedDepartment?.name} • {selectedSemester?.name} •{" "}
                      {selectedSection?.name}
                    </p>
                  </div>

                  {/* Day Picker with all 7 days */}
                  <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                    {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                      const dayCount = routineEntries.filter(
                        (e) => e.day_of_week === dayIdx,
                      ).length;
                      const isToday = dayIdx === todayDayIdx;
                      return (
                        <button
                          key={dayIdx}
                          onClick={() => setSelectedDay(dayIdx)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                            selectedDay === dayIdx
                              ? "bg-white text-blue-700 shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <span>{DAYS[dayIdx].slice(0, 3)}</span>
                          {dayCount > 0 && (
                            <span
                              className={`text-[10px] px-1 rounded-full ${
                                selectedDay === dayIdx
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {dayCount}
                            </span>
                          )}
                          {isToday && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                              title="Today"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Day Routine Cards */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span>{DAYS[selectedDay]}'s Classes</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {routineByDay.length} {routineByDay.length === 1 ? "Class" : "Classes"}
                      </span>
                      {selectedDay === todayDayIdx && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Today
                        </span>
                      )}
                    </h2>
                  </div>

                  {isRoutineLoading ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                      <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Loading routine schedule...</p>
                    </div>
                  ) : routineByDay.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-800">
                        No classes scheduled
                      </h3>
                      <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                        There are no classes registered for {DAYS[selectedDay]} for this section.
                        Check other days using the day selector above.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {routineByDay.map((entry: RoutineEntryDetailed) => (
                        <RoutineCard key={entry.id} entry={entry} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Full Week Schedule Overview */}
                <div className="mt-8 bg-white rounded-2xl p-6 border border-slate-200">
                  <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>Complete Week at a Glance</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                      const dayClasses = routineEntries.filter((e) => e.day_of_week === dayIdx);
                      const isToday = dayIdx === todayDayIdx;
                      return (
                        <div
                          key={dayIdx}
                          onClick={() => setSelectedDay(dayIdx)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedDay === dayIdx
                              ? "border-blue-500 bg-blue-50/50 shadow-xs"
                              : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-semibold mb-2">
                            <span
                              className={`flex items-center gap-1 ${
                                selectedDay === dayIdx ? "text-blue-700" : "text-slate-700"
                              }`}
                            >
                              <span>{DAYS[dayIdx].slice(0, 3)}</span>
                              {isToday && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              )}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                              {dayClasses.length}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {dayClasses.map((cls) => (
                              <div
                                key={cls.id}
                                className="text-[11px] p-1.5 rounded-md bg-white border border-slate-200/80 truncate"
                              >
                                <span className="font-bold text-slate-800">
                                  {cls.course?.course_code}
                                </span>
                                <span className="text-slate-400 text-[10px] ml-1">
                                  ({cls.room?.room_number})
                                </span>
                              </div>
                            ))}
                            {dayClasses.length === 0 && (
                              <p className="text-[11px] text-slate-400 italic py-2 text-center">
                                Off day
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* FACULTY DIRECTORY VIEW */}
            {activeTab === "faculty" && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                      Faculty Directory
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Faculty members, designations, offices, and consultation contacts
                    </p>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search name or initials..."
                      value={facultySearch}
                      onChange={(e) => setFacultySearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {facultyList
                    .filter(
                      (f) =>
                        f.name.toLowerCase().includes(facultySearch.toLowerCase()) ||
                        (f.short_name &&
                          f.short_name.toLowerCase().includes(facultySearch.toLowerCase())),
                    )
                    .map((fac) => (
                      <div
                        key={fac.id}
                        className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-slate-300 transition-shadow shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-slate-900 text-base">{fac.name}</h3>
                              {fac.short_name && (
                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                                  {fac.short_name}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-medium text-blue-600 mt-0.5">
                              {fac.designation}
                            </p>
                          </div>
                        </div>

                        {fac.bio && (
                          <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                            {fac.bio}
                          </p>
                        )}

                        <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                          {fac.email && (
                            <div className="flex items-center gap-2 truncate">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{fac.email}</span>
                            </div>
                          )}
                          {fac.office && (
                            <div className="flex items-center gap-2 truncate">
                              <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{fac.office}</span>
                            </div>
                          )}
                          {fac.phone && (
                            <div className="flex items-center gap-2 truncate">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{fac.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* COURSES VIEW */}
            {activeTab === "courses" && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                      Academic Courses
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Department syllabus, course codes, and credit weighting
                    </p>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search code or course title..."
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {coursesList
                    .filter(
                      (c) =>
                        c.course_code.toLowerCase().includes(courseSearch.toLowerCase()) ||
                        c.course_name.toLowerCase().includes(courseSearch.toLowerCase()),
                    )
                    .map((course) => (
                      <div
                        key={course.id}
                        className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-slate-300 transition-shadow shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                              {course.course_code}
                            </span>
                            <h3 className="font-bold text-slate-900 text-base mt-1.5">
                              {course.course_name}
                            </h3>
                          </div>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 shrink-0">
                            {course.credit} Credits
                          </span>
                        </div>
                        {course.description && (
                          <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                            {course.description}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* ROOMS & FINDER VIEW */}
            {activeTab === "rooms" && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                      Campus Rooms & Finder
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Lecture halls, smart classrooms, and computer laboratories
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Type:</span>
                    <select
                      value={roomFilter}
                      onChange={(e) => setRoomFilter(e.target.value)}
                      className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="all">All Room Types</option>
                      <option value="theory">Theory Classrooms</option>
                      <option value="smart_classroom">Smart Classrooms</option>
                      <option value="computer_lab">Computer Labs</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roomsList
                    .filter((rm) => roomFilter === "all" || rm.room_type === roomFilter)
                    .map((room) => (
                      <div
                        key={room.id}
                        className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-slate-300 transition-all shadow-xs"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-slate-900 text-lg">
                              Room {room.room_number}
                            </h3>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                {room.building}, Floor {room.floor}
                              </span>
                            </p>
                          </div>
                          <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {room.room_type.replace("_", " ")}
                          </span>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                          <span>Seating Capacity</span>
                          <span className="font-bold text-slate-900">{room.capacity} seats</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* NOTICES VIEW */}
            {activeTab === "notices" && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Academic Notices</h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Official announcements, exam schedules, and department bulletins
                  </p>
                </div>

                <div className="space-y-4">
                  {noticesList.map((notice) => (
                    <div
                      key={notice.id}
                      className={`bg-white rounded-2xl p-6 border transition-shadow shadow-xs ${
                        notice.is_pinned
                          ? "border-blue-300 ring-1 ring-blue-100"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {notice.is_pinned && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 flex items-center gap-1">
                              📌 Pinned
                            </span>
                          )}
                          <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {notice.notice_type}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(notice.published_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        {notice.title}
                      </h3>
                      {notice.description && (
                        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                          {notice.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function RoutineCard({ entry }: { entry: RoutineEntryDetailed }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-slate-300 transition-shadow shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80">
              {entry.course?.course_code}
            </span>
            <h3 className="font-bold text-slate-900 text-base mt-2">{entry.course?.course_name}</h3>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-700 shrink-0">
            {entry.course?.credit} Cr
          </span>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-800">
              {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Room <strong className="text-slate-800">{entry.room?.room_number}</strong> (
              {entry.room?.building})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Instructor: <strong className="text-slate-800">{entry.faculty?.name}</strong>{" "}
              {entry.faculty?.short_name && `(${entry.faculty.short_name})`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  count,
  icon: Icon,
  customLabel,
}: {
  title: string;
  count: number;
  icon: LucideIcon;
  customLabel?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
      <div className="flex items-center justify-between text-slate-500 mb-2">
        <span className="text-xs font-medium text-slate-500">{title}</span>
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div className="text-2xl font-bold text-slate-900">{customLabel ?? count}</div>
    </div>
  );
}

function StatusItem({ text, done }: { text: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
        <Check className="w-3 h-3 stroke-[3]" />
      </div>
      <span className="text-slate-700 font-medium">{text}</span>
    </div>
  );
}

function OnboardingSection({
  departments,
  semesters,
  sections,
  departmentId,
  semesterId,
  sectionId,
  onSelectDepartment,
  onSelectSemester,
  onSelectSection,
  onQuickDemo,
}: {
  departments: Department[];
  semesters: Semester[];
  sections: Section[];
  departmentId: string | null;
  semesterId: string | null;
  sectionId: string | null;
  onSelectDepartment: (id: string) => void;
  onSelectSemester: (id: string) => void;
  onSelectSection: (id: string) => void;
  onQuickDemo: () => void;
}) {
  return (
    <div className="max-w-xl mx-auto py-8">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-700 text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-blue-500/20">
          <GraduationCap className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900">Your University, Organized.</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
          Access your class routine, faculty contacts, room availability, and academic announcements
          in one unified platform.
        </p>

        {/* Step 1: Department */}
        <div className="mt-8 text-left space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              1. Select Department
            </label>
            <select
              value={departmentId ?? ""}
              onChange={(e) => onSelectDepartment(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="" disabled>
                Choose department...
              </option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.code} — {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Semester */}
          {departmentId && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                2. Select Semester
              </label>
              <select
                value={semesterId ?? ""}
                onChange={(e) => onSelectSemester(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="" disabled>
                  Choose semester...
                </option>
                {semesters.map((sem) => (
                  <option key={sem.id} value={sem.id}>
                    {sem.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Step 3: Section */}
          {semesterId && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                3. Select Section
              </label>
              <select
                value={sectionId ?? ""}
                onChange={(e) => onSelectSection(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="" disabled>
                  Choose section...
                </option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Quick Demo CTA */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-400">Want to quickly explore?</span>
          <button
            onClick={onQuickDemo}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors shadow-xs"
          >
            <span>View CSE Routine</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
