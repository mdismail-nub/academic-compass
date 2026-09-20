import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  BookOpen,
  Users,
  DoorOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  X,
  Building,
} from "lucide-react";

import {
  allRoutineEntriesQuery,
  departmentsQuery,
  semestersQuery,
  sectionsQuery,
  coursesQuery,
  facultyQuery,
  roomsQuery,
  createRoutineEntry,
  updateRoutineEntry,
  deleteRoutineEntry,
} from "@/lib/api";
import { checkRoutineConflict } from "@/lib/routine-conflicts";
import type {
  RoutineEntryDetailed,
  RoutineEntryInsert,
  Department,
  Semester,
  Section,
  Course,
  Faculty,
  Room,
} from "@/lib/types";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0] ?? "0", 10);
  const minutes = parts[1] ?? "00";
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${formattedHours}:${minutes} ${ampm}`;
}

interface RoutineManagementProps {
  onOpenCsvImport?: () => void;
}

export function RoutineManagement({ onOpenCsvImport }: RoutineManagementProps) {
  const queryClient = useQueryClient();

  // Queries
  const { data: routineEntries = [], isLoading: routineLoading } =
    useQuery(allRoutineEntriesQuery());
  const { data: departments = [] } = useQuery(departmentsQuery());
  const { data: courses = [] } = useQuery(coursesQuery());
  const { data: facultyList = [] } = useQuery(facultyQuery());
  const { data: rooms = [] } = useQuery(roomsQuery());

  // Filter States
  const [filterDept, setFilterDept] = useState<string>("ALL");
  const [filterSem, setFilterSem] = useState<string>("ALL");
  const [filterSec, setFilterSec] = useState<string>("ALL");
  const [filterDay, setFilterDay] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Cascaded filter queries
  const { data: semesters = [] } = useQuery(
    semestersQuery(filterDept === "ALL" ? null : filterDept),
  );
  const { data: sections = [] } = useQuery(sectionsQuery(filterSem === "ALL" ? null : filterSem));

  // Modal Form State (Add / Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RoutineEntryDetailed | null>(null);

  // Form Field States
  const [formDeptId, setFormDeptId] = useState<string>("");
  const [formSemId, setFormSemId] = useState<string>("");
  const [formSectionId, setFormSectionId] = useState<string>("");
  const [formCourseId, setFormCourseId] = useState<string>("");
  const [formFacultyId, setFormFacultyId] = useState<string>("");
  const [formRoomId, setFormRoomId] = useState<string>("");
  const [formDayOfWeek, setFormDayOfWeek] = useState<number>(0);
  const [formStartTime, setFormStartTime] = useState<string>("09:30");
  const [formEndTime, setFormEndTime] = useState<string>("10:50");

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cascaded dropdown data for Form
  const { data: formSemesters = [] } = useQuery(semestersQuery(formDeptId || null));
  const { data: formSections = [] } = useQuery(sectionsQuery(formSemId || null));
  const { data: formCourses = [] } = useQuery(coursesQuery(formDeptId || null));

  // Delete Dialog State
  const [deletingEntry, setDeletingEntry] = useState<RoutineEntryDetailed | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtered Routine Entries
  const filteredEntries = useMemo(() => {
    return routineEntries.filter((entry) => {
      // Department Filter
      if (filterDept !== "ALL") {
        const deptId = entry.section?.semester?.department_id;
        if (deptId !== filterDept) return false;
      }
      // Semester Filter
      if (filterSem !== "ALL") {
        const semId = entry.section?.semester?.id;
        if (semId !== filterSem) return false;
      }
      // Section Filter
      if (filterSec !== "ALL") {
        if (entry.section_id !== filterSec) return false;
      }
      // Day Filter
      if (filterDay !== "ALL") {
        if (entry.day_of_week !== parseInt(filterDay, 10)) return false;
      }
      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const courseCode = entry.course?.course_code?.toLowerCase() ?? "";
        const courseName = entry.course?.course_name?.toLowerCase() ?? "";
        const facultyName = entry.faculty?.name?.toLowerCase() ?? "";
        const facultyShort = entry.faculty?.short_name?.toLowerCase() ?? "";
        const roomNum = entry.room?.room_number?.toLowerCase() ?? "";
        const sectionName = entry.section?.name?.toLowerCase() ?? "";

        const match =
          courseCode.includes(q) ||
          courseName.includes(q) ||
          facultyName.includes(q) ||
          facultyShort.includes(q) ||
          roomNum.includes(q) ||
          sectionName.includes(q);

        if (!match) return false;
      }
      return true;
    });
  }, [routineEntries, filterDept, filterSem, filterSec, filterDay, searchQuery]);

  // Real-time pre-flight conflict check in form
  const activeConflict = useMemo(() => {
    if (!formSectionId || !formCourseId || !formStartTime || !formEndTime) {
      return null;
    }
    return checkRoutineConflict({
      existingEntries: routineEntries,
      currentEntryId: editingEntry ? editingEntry.id : null,
      sectionId: formSectionId,
      courseId: formCourseId,
      facultyId: formFacultyId || null,
      roomId: formRoomId || null,
      dayOfWeek: formDayOfWeek,
      startTime: formStartTime,
      endTime: formEndTime,
    });
  }, [
    routineEntries,
    editingEntry,
    formSectionId,
    formCourseId,
    formFacultyId,
    formRoomId,
    formDayOfWeek,
    formStartTime,
    formEndTime,
  ]);

  // Open Add Dialog
  const handleOpenAdd = () => {
    setEditingEntry(null);
    setFormError(null);

    // Default to first department if available
    const defaultDept = filterDept !== "ALL" ? filterDept : (departments[0]?.id ?? "");
    setFormDeptId(defaultDept);
    setFormSemId("");
    setFormSectionId("");
    setFormCourseId("");
    setFormFacultyId("");
    setFormRoomId("");
    setFormDayOfWeek(filterDay !== "ALL" ? parseInt(filterDay, 10) : 0);
    setFormStartTime("09:30");
    setFormEndTime("10:50");

    setIsFormOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (entry: RoutineEntryDetailed) => {
    setEditingEntry(entry);
    setFormError(null);

    const deptId = entry.section?.semester?.department_id ?? "";
    const semId = entry.section?.semester?.id ?? "";

    setFormDeptId(deptId);
    setFormSemId(semId);
    setFormSectionId(entry.section_id);
    setFormCourseId(entry.course_id);
    setFormFacultyId(entry.faculty_id ?? "");
    setFormRoomId(entry.room_id ?? "");
    setFormDayOfWeek(entry.day_of_week);
    setFormStartTime(entry.start_time.slice(0, 5));
    setFormEndTime(entry.end_time.slice(0, 5));

    setIsFormOpen(true);
  };

  // Handle Form Submission
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formSectionId) {
      setFormError("Please select a valid section.");
      return;
    }
    if (!formCourseId) {
      setFormError("Please select a course.");
      return;
    }
    if (!formStartTime || !formEndTime) {
      setFormError("Please specify valid start and end times.");
      return;
    }

    if (activeConflict?.hasConflict) {
      setFormError(activeConflict.message || "Conflict detected.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: RoutineEntryInsert = {
        section_id: formSectionId,
        course_id: formCourseId,
        faculty_id: formFacultyId || null,
        room_id: formRoomId || null,
        day_of_week: formDayOfWeek,
        start_time: formStartTime.length === 5 ? `${formStartTime}:00` : formStartTime,
        end_time: formEndTime.length === 5 ? `${formEndTime}:00` : formEndTime,
      };

      if (editingEntry) {
        await updateRoutineEntry(editingEntry.id, payload);
      } else {
        await createRoutineEntry(payload);
      }

      await queryClient.invalidateQueries({ queryKey: ["routine"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "counts"] });
      setIsFormOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save routine entry.";
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!deletingEntry) return;
    setIsDeleting(true);
    try {
      await deleteRoutineEntry(deletingEntry.id);
      await queryClient.invalidateQueries({ queryKey: ["routine"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "counts"] });
      setDeletingEntry(null);
    } catch (err: unknown) {
      console.error("Failed to delete routine entry", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const clearFilters = () => {
    setFilterDept("ALL");
    setFilterSem("ALL");
    setFilterSec("ALL");
    setFilterDay("ALL");
    setSearchQuery("");
  };

  const hasActiveFilters =
    filterDept !== "ALL" ||
    filterSem !== "ALL" ||
    filterSec !== "ALL" ||
    filterDay !== "ALL" ||
    Boolean(searchQuery.trim());

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center p-2 rounded-xl bg-blue-50 text-blue-600">
                <Calendar className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Routine Management
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                {routineEntries.length} total entries
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Add, edit, filter, or delete university class routine entries with real-time schedule
              conflict prevention.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onOpenCsvImport && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenCsvImport}
                className="gap-1.5 text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900 font-medium"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Import CSV
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleOpenAdd}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Add Routine Entry
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Department Filter */}
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Department</Label>
            <select
              value={filterDept}
              onChange={(e) => {
                setFilterDept(e.target.value);
                setFilterSem("ALL");
                setFilterSec("ALL");
              }}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d: Department) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Semester</Label>
            <select
              value={filterSem}
              disabled={filterDept === "ALL"}
              onChange={(e) => {
                setFilterSem(e.target.value);
                setFilterSec("ALL");
              }}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-50"
            >
              <option value="ALL">All Semesters</option>
              {semesters.map((s: Semester) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Semester {s.number})
                </option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Section</Label>
            <select
              value={filterSec}
              disabled={filterSem === "ALL"}
              onChange={(e) => setFilterSec(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-50"
            >
              <option value="ALL">All Sections</option>
              {sections.map((sec: Section) => (
                <option key={sec.id} value={sec.id}>
                  Section {sec.name}
                </option>
              ))}
            </select>
          </div>

          {/* Day Filter */}
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Day of Week</Label>
            <select
              value={filterDay}
              onChange={(e) => setFilterDay(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">All Days</option>
              {DAYS.map((day, idx) => (
                <option key={day} value={idx}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Search</Label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Course, Faculty, Room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-xs border-slate-200"
              />
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
            <span>
              Showing <strong>{filteredEntries.length}</strong> of {routineEntries.length} entries
              matching current filters.
            </span>
            <button
              onClick={clearFilters}
              className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Routine Entries Table (Desktop) & Card List (Mobile) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {routineLoading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="inline-block animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mb-3" />
            <p className="text-sm font-medium text-slate-600">Loading routine entries...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">No routine entries found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {hasActiveFilters
                ? "No entries match your search or filter criteria. Try clearing some filters."
                : "No schedule entries have been created yet. Click 'Add Routine Entry' to create the first one."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4 text-xs">
                Reset all filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Day</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Section</th>
                    <th className="py-3 px-4">Course</th>
                    <th className="py-3 px-4">Faculty</th>
                    <th className="py-3 px-4">Room</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* Day */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-medium text-xs bg-slate-100 text-slate-700 border border-slate-200/60">
                          {DAYS[entry.day_of_week]}
                        </span>
                      </td>

                      {/* Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                          </span>
                        </div>
                      </td>

                      {/* Section */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          Sec {entry.section?.name ?? "—"}
                        </div>
                        {entry.section?.semester && (
                          <div className="text-[11px] text-slate-500">
                            Sem {entry.section.semester.number}
                          </div>
                        )}
                      </td>

                      {/* Course */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {entry.course?.course_code ?? "—"}
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          {entry.course?.course_name ?? ""}
                        </div>
                      </td>

                      {/* Faculty */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {entry.faculty ? (
                          <div className="flex items-center gap-2">
                            {entry.faculty.short_name && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px] tracking-wide border border-blue-100">
                                {entry.faculty.short_name}
                              </span>
                            )}
                            <span className="text-slate-700">{entry.faculty.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Room */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {entry.room ? (
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            <span>Room {entry.room.room_number}</span>
                            <span className="text-[10px] text-slate-400">
                              ({entry.room.building})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">TBA</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(entry)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                            title="Edit entry"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingEntry(entry)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredEntries.map((entry) => (
                <div key={entry.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center px-2 py-0.5 rounded font-semibold text-xs bg-slate-100 text-slate-700">
                      {DAYS[entry.day_of_week]}
                    </span>
                    <div className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {entry.course?.course_code} · {entry.course?.course_name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Section {entry.section?.name}
                      {entry.section?.semester && ` (Sem ${entry.section.semester.number})`}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    {entry.faculty && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                        <Users className="w-3 h-3" />
                        {entry.faculty.short_name || entry.faculty.name}
                      </span>
                    )}
                    {entry.room && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        <DoorOpen className="w-3 h-3" />
                        Room {entry.room.room_number} ({entry.room.building})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(entry)}
                      className="h-8 text-xs gap-1 text-slate-700"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingEntry(entry)}
                      className="h-8 text-xs gap-1 text-rose-600 border-rose-200 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Routine Entry Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {editingEntry ? "Edit Routine Entry" : "Add Routine Entry"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Fill out the schedule details. Real-time conflict checks will alert you if room,
              instructor, or section overlap.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitForm} className="space-y-4 pt-2">
            {/* Conflict Warning Alert */}
            {activeConflict?.hasConflict && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block text-amber-950">
                    Schedule Conflict Detected
                  </strong>
                  <span>{activeConflict.message}</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {formError}
              </div>
            )}

            {/* Cascading Context: Department -> Semester -> Section */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Department */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Department *
                </Label>
                <select
                  value={formDeptId}
                  onChange={(e) => {
                    setFormDeptId(e.target.value);
                    setFormSemId("");
                    setFormSectionId("");
                  }}
                  required
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="" disabled>
                    Select Dept
                  </option>
                  {departments.map((d: Department) => (
                    <option key={d.id} value={d.id}>
                      {d.code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Semester *
                </Label>
                <select
                  value={formSemId}
                  disabled={!formDeptId}
                  onChange={(e) => {
                    setFormSemId(e.target.value);
                    setFormSectionId("");
                  }}
                  required
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="" disabled>
                    Select Semester
                  </option>
                  {formSemesters.map((s: Semester) => (
                    <option key={s.id} value={s.id}>
                      Sem {s.number} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">Section *</Label>
                <select
                  value={formSectionId}
                  disabled={!formSemId}
                  onChange={(e) => setFormSectionId(e.target.value)}
                  required
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="" disabled>
                    Select Section
                  </option>
                  {formSections.map((sec: Section) => (
                    <option key={sec.id} value={sec.id}>
                      Section {sec.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Course Select */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Course *</Label>
              <select
                value={formCourseId}
                onChange={(e) => setFormCourseId(e.target.value)}
                required
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="" disabled>
                  Select Course
                </option>
                {(formCourses.length > 0 ? formCourses : courses).map((c: Course) => (
                  <option key={c.id} value={c.id}>
                    {c.course_code} — {c.course_name} ({c.credit} cr)
                  </option>
                ))}
              </select>
            </div>

            {/* Faculty & Room Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Faculty Dropdown */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Faculty Instructor
                </Label>
                <select
                  value={formFacultyId}
                  onChange={(e) => setFormFacultyId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">No Instructor Assigned</option>
                  {facultyList.map((f: Faculty) => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.short_name ? `(${f.short_name})` : ""} -{" "}
                      {f.designation || "Faculty"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Room Dropdown */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Classroom / Lab
                </Label>
                <select
                  value={formRoomId}
                  onChange={(e) => setFormRoomId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">No Room Assigned (TBA)</option>
                  {rooms.map((r: Room) => (
                    <option key={r.id} value={r.id}>
                      Room {r.room_number} ({r.building}, {r.room_type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Day & Timing Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Day of Week */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Day of Week *
                </Label>
                <select
                  value={formDayOfWeek}
                  onChange={(e) => setFormDayOfWeek(parseInt(e.target.value, 10))}
                  required
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {DAYS.map((day, idx) => (
                    <option key={day} value={idx}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Time */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Start Time *
                </Label>
                <Input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>

              {/* End Time */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                  End Time *
                </Label>
                <Input
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFormOpen(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || Boolean(activeConflict?.hasConflict)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium gap-1.5"
              >
                {isSubmitting ? (
                  "Saving..."
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {editingEntry ? "Save Changes" : "Create Routine Entry"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={Boolean(deletingEntry)}
        onOpenChange={(open) => !open && setDeletingEntry(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Delete Routine Entry?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Are you sure you want to delete this schedule slot for{" "}
              <strong>{deletingEntry?.course?.course_code}</strong> (Section{" "}
              {deletingEntry?.section?.name}) on{" "}
              <strong>{deletingEntry ? DAYS[deletingEntry.day_of_week] : ""}</strong> from{" "}
              {deletingEntry ? formatTime(deletingEntry.start_time) : ""} to{" "}
              {deletingEntry ? formatTime(deletingEntry.end_time) : ""}? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
            >
              {isDeleting ? "Deleting..." : "Yes, Delete Entry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
