import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Download,
  Building,
  Calendar,
  Layers,
  FileText,
} from "lucide-react";

import {
  allRoutineEntriesQuery,
  departmentsQuery,
  semestersQuery,
  sectionsQuery,
  coursesQuery,
  facultyQuery,
  roomsQuery,
  batchCreateRoutineEntries,
} from "@/lib/api";
import { doIntervalsOverlap } from "@/lib/routine-conflicts";
import type {
  Department,
  Semester,
  Section,
  Course,
  Faculty,
  Room,
  RoutineEntryInsert,
  RoutineEntryDetailed,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const DAYS_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  "0": 0,
  monday: 1,
  mon: 1,
  "1": 1,
  tuesday: 2,
  tue: 2,
  "2": 2,
  wednesday: 3,
  wed: 3,
  "3": 3,
  thursday: 4,
  thu: 4,
  "4": 4,
  friday: 5,
  fri: 5,
  "5": 5,
  saturday: 6,
  sat: 6,
  "6": 6,
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface ParsedRowResult {
  rowNumber: number;
  rawText: string;
  isValid: boolean;
  hasConflict: boolean;
  status: "valid" | "conflict" | "error";
  message?: string;
  // Resolved entities
  sectionName: string;
  courseCode: string;
  facultyShort: string;
  roomNumber: string;
  dayString: string;
  startTime: string;
  endTime: string;
  // IDs for insertion
  payload?: RoutineEntryInsert;
}

interface CsvRoutineImportProps {
  onBackToManager: () => void;
}

const SAMPLE_CSV = `section,course,faculty,room,day,start,end
A,CSE1101,MHA,301,Sunday,09:30,10:50
A,CSE1102,SRY,Lab 1,Sunday,11:00,12:20
B,CSE1101,JRZ,302,Monday,09:30,10:50
B,MAT1103,MHA,301,Monday,11:00,12:20
A,CSE1105,JRZ,302,Tuesday,13:00,14:20`;

export function CsvRoutineImport({ onBackToManager }: CsvRoutineImportProps) {
  const queryClient = useQueryClient();

  // Queries
  const { data: departments = [] } = useQuery(departmentsQuery());
  const { data: existingEntries = [] } = useQuery(allRoutineEntriesQuery());
  const { data: allCourses = [] } = useQuery(coursesQuery());
  const { data: allFaculty = [] } = useQuery(facultyQuery());
  const { data: allRooms = [] } = useQuery(roomsQuery());

  // Context Selection for Import Scope
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [selectedSemId, setSelectedSemId] = useState<string>("");

  const { data: semesters = [] } = useQuery(semestersQuery(selectedDeptId || null));
  const { data: sections = [] } = useQuery(sectionsQuery(selectedSemId || null));

  // Raw CSV Content
  const [csvContent, setCsvContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<ParsedRowResult[]>([]);
  const [hasProcessed, setHasProcessed] = useState<boolean>(false);

  // Filter view for results table
  const [activeTab, setActiveTab] = useState<"all" | "valid" | "issues">("all");

  // Import State
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);

  // File Upload Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      setHasProcessed(false);
      setImportSuccessCount(null);
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setFileName("sample_routine.csv");
    setCsvContent(SAMPLE_CSV);
    setHasProcessed(false);
    setImportSuccessCount(null);
  };

  // Parse and validate CSV rows
  const handleProcessCsv = () => {
    if (!selectedDeptId || !selectedSemId) {
      alert("Please select a target Department and Semester first.");
      return;
    }

    if (!csvContent.trim()) {
      alert("Please upload or paste CSV data.");
      return;
    }

    const lines = csvContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) return;

    // Detect header
    let startIdx = 0;
    const firstLine = lines[0].toLowerCase();
    if (
      firstLine.includes("section") ||
      firstLine.includes("course") ||
      firstLine.includes("start")
    ) {
      startIdx = 1;
    }

    const results: ParsedRowResult[] = [];
    const internalBatch: RoutineEntryInsert[] = [];

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
      const rowNum = i + 1;

      if (parts.length < 7) {
        results.push({
          rowNumber: rowNum,
          rawText: line,
          isValid: false,
          hasConflict: false,
          status: "error",
          message: `Expected 7 columns (section, course, faculty, room, day, start, end), got ${parts.length}.`,
          sectionName: parts[0] || "",
          courseCode: parts[1] || "",
          facultyShort: parts[2] || "",
          roomNumber: parts[3] || "",
          dayString: parts[4] || "",
          startTime: parts[5] || "",
          endTime: parts[6] || "",
        });
        continue;
      }

      const [secStr, courseStr, facStr, roomStr, dayStr, startStr, endStr] = parts;

      // 1. Resolve Section
      const matchedSection = sections.find(
        (s: Section) => s.name.toLowerCase() === secStr.toLowerCase(),
      );
      if (!matchedSection) {
        results.push({
          rowNumber: rowNum,
          rawText: line,
          isValid: false,
          hasConflict: false,
          status: "error",
          message: `Section '${secStr}' not found in selected semester.`,
          sectionName: secStr,
          courseCode: courseStr,
          facultyShort: facStr,
          roomNumber: roomStr,
          dayString: dayStr,
          startTime: startStr,
          endTime: endStr,
        });
        continue;
      }

      // 2. Resolve Course
      const matchedCourse = allCourses.find(
        (c: Course) => c.course_code.toLowerCase() === courseStr.toLowerCase(),
      );
      if (!matchedCourse) {
        results.push({
          rowNumber: rowNum,
          rawText: line,
          isValid: false,
          hasConflict: false,
          status: "error",
          message: `Course '${courseStr}' not found in catalog.`,
          sectionName: secStr,
          courseCode: courseStr,
          facultyShort: facStr,
          roomNumber: roomStr,
          dayString: dayStr,
          startTime: startStr,
          endTime: endStr,
        });
        continue;
      }

      // 3. Resolve Faculty (Optional)
      let matchedFaculty: Faculty | undefined;
      if (facStr && facStr.toLowerCase() !== "tba" && facStr.toLowerCase() !== "none") {
        matchedFaculty = allFaculty.find((f: Faculty) => {
          const shortMatch = f.short_name?.toLowerCase() === facStr.toLowerCase();
          const nameMatch = f.name.toLowerCase().includes(facStr.toLowerCase());
          return shortMatch || nameMatch;
        });

        if (!matchedFaculty) {
          results.push({
            rowNumber: rowNum,
            rawText: line,
            isValid: false,
            hasConflict: false,
            status: "error",
            message: `Faculty '${facStr}' not found in faculty directory.`,
            sectionName: secStr,
            courseCode: courseStr,
            facultyShort: facStr,
            roomNumber: roomStr,
            dayString: dayStr,
            startTime: startStr,
            endTime: endStr,
          });
          continue;
        }
      }

      // 4. Resolve Room (Optional)
      let matchedRoom: Room | undefined;
      if (roomStr && roomStr.toLowerCase() !== "tba" && roomStr.toLowerCase() !== "none") {
        matchedRoom = allRooms.find((r: Room) => {
          const cleanRoomInput = roomStr.toLowerCase().replace(/^room\s*/, "");
          const cleanRoomDB = r.room_number.toLowerCase().replace(/^room\s*/, "");
          return cleanRoomDB === cleanRoomInput;
        });

        if (!matchedRoom) {
          results.push({
            rowNumber: rowNum,
            rawText: line,
            isValid: false,
            hasConflict: false,
            status: "error",
            message: `Room '${roomStr}' not found in room directory.`,
            sectionName: secStr,
            courseCode: courseStr,
            facultyShort: facStr,
            roomNumber: roomStr,
            dayString: dayStr,
            startTime: startStr,
            endTime: endStr,
          });
          continue;
        }
      }

      // 5. Resolve Day of Week
      const dayKey = dayStr.toLowerCase().trim();
      const dayOfWeek = DAYS_MAP[dayKey];
      if (dayOfWeek === undefined) {
        results.push({
          rowNumber: rowNum,
          rawText: line,
          isValid: false,
          hasConflict: false,
          status: "error",
          message: `Invalid day '${dayStr}'. Use Sunday, Monday, etc.`,
          sectionName: secStr,
          courseCode: courseStr,
          facultyShort: facStr,
          roomNumber: roomStr,
          dayString: dayStr,
          startTime: startStr,
          endTime: endStr,
        });
        continue;
      }

      // 6. Validate Time format & sequence
      const timeRegex = /^\d{1,2}:\d{2}$/;
      if (!timeRegex.test(startStr) || !timeRegex.test(endStr)) {
        results.push({
          rowNumber: rowNum,
          rawText: line,
          isValid: false,
          hasConflict: false,
          status: "error",
          message: `Time format must be HH:mm (e.g. 09:30), got ${startStr} - ${endStr}.`,
          sectionName: secStr,
          courseCode: courseStr,
          facultyShort: facStr,
          roomNumber: roomStr,
          dayString: dayStr,
          startTime: startStr,
          endTime: endStr,
        });
        continue;
      }

      const [sH, sM] = startStr.split(":").map((v) => parseInt(v, 10));
      const [eH, eM] = endStr.split(":").map((v) => parseInt(v, 10));
      const startMins = sH * 60 + sM;
      const endMins = eH * 60 + eM;

      if (startMins >= endMins) {
        results.push({
          rowNumber: rowNum,
          rawText: line,
          isValid: false,
          hasConflict: false,
          status: "error",
          message: `Start time (${startStr}) must be before end time (${endStr}).`,
          sectionName: secStr,
          courseCode: courseStr,
          facultyShort: facStr,
          roomNumber: roomStr,
          dayString: dayStr,
          startTime: startStr,
          endTime: endStr,
        });
        continue;
      }

      // 7. Check Conflicts against Existing Routine Entries in DB
      let conflictMsg: string | null = null;
      for (const ex of existingEntries) {
        if (ex.day_of_week !== dayOfWeek) continue;
        const overlaps = doIntervalsOverlap(startStr, endStr, ex.start_time, ex.end_time);
        if (!overlaps) continue;

        if (ex.section_id === matchedSection.id) {
          conflictMsg = `Section Conflict: Sec ${secStr} already has ${ex.course?.course_code} (${ex.start_time.slice(0, 5)} - ${ex.end_time.slice(0, 5)})`;
          break;
        }
        if (matchedRoom && ex.room_id === matchedRoom.id) {
          conflictMsg = `Room Conflict: Room ${matchedRoom.room_number} occupied by ${ex.course?.course_code} (${ex.start_time.slice(0, 5)} - ${ex.end_time.slice(0, 5)})`;
          break;
        }
        if (matchedFaculty && ex.faculty_id === matchedFaculty.id) {
          conflictMsg = `Faculty Conflict: ${matchedFaculty.short_name || matchedFaculty.name} is teaching ${ex.course?.course_code} (${ex.start_time.slice(0, 5)} - ${ex.end_time.slice(0, 5)})`;
          break;
        }
      }

      // 8. Check Conflicts within earlier rows of this CSV batch
      if (!conflictMsg) {
        for (const batchEntry of internalBatch) {
          if (batchEntry.day_of_week !== dayOfWeek) continue;
          const overlaps = doIntervalsOverlap(
            startStr,
            endStr,
            batchEntry.start_time,
            batchEntry.end_time,
          );
          if (!overlaps) continue;

          if (batchEntry.section_id === matchedSection.id) {
            conflictMsg = `Section Conflict within CSV: Sec ${secStr} assigned multiple classes at ${startStr} - ${endStr}`;
            break;
          }
          if (matchedRoom && batchEntry.room_id === matchedRoom.id) {
            conflictMsg = `Room Conflict within CSV: Room ${matchedRoom.room_number} assigned multiple classes at ${startStr} - ${endStr}`;
            break;
          }
          if (matchedFaculty && batchEntry.faculty_id === matchedFaculty.id) {
            conflictMsg = `Faculty Conflict within CSV: Faculty assigned multiple classes at ${startStr} - ${endStr}`;
            break;
          }
        }
      }

      if (conflictMsg) {
        results.push({
          rowNumber: rowNum,
          rawText: line,
          isValid: false,
          hasConflict: true,
          status: "conflict",
          message: conflictMsg,
          sectionName: secStr,
          courseCode: courseStr,
          facultyShort: facStr,
          roomNumber: roomStr,
          dayString: dayStr,
          startTime: startStr,
          endTime: endStr,
        });
        continue;
      }

      // Valid entry!
      const payload: RoutineEntryInsert = {
        section_id: matchedSection.id,
        course_id: matchedCourse.id,
        faculty_id: matchedFaculty?.id ?? null,
        room_id: matchedRoom?.id ?? null,
        day_of_week: dayOfWeek,
        start_time: `${startStr}:00`,
        end_time: `${endStr}:00`,
      };

      internalBatch.push(payload);

      results.push({
        rowNumber: rowNum,
        rawText: line,
        isValid: true,
        hasConflict: false,
        status: "valid",
        sectionName: secStr,
        courseCode: courseStr,
        facultyShort: facStr,
        roomNumber: roomStr,
        dayString: dayStr,
        startTime: startStr,
        endTime: endStr,
        payload,
      });
    }

    setParsedRows(results);
    setHasProcessed(true);
  };

  // Valid rows ready to import
  const validRows = useMemo(() => {
    return parsedRows.filter((r) => r.isValid && r.payload);
  }, [parsedRows]);

  const issuesRows = useMemo(() => {
    return parsedRows.filter((r) => !r.isValid);
  }, [parsedRows]);

  const displayedRows = useMemo(() => {
    if (activeTab === "valid") return validRows;
    if (activeTab === "issues") return issuesRows;
    return parsedRows;
  }, [parsedRows, validRows, issuesRows, activeTab]);

  // Execute Batch Import
  const handleConfirmImport = async () => {
    if (validRows.length === 0) return;
    setIsImporting(true);
    try {
      const payloads = validRows.map((r) => r.payload!);
      const res = await batchCreateRoutineEntries(payloads);
      await queryClient.invalidateQueries({ queryKey: ["routine"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "counts"] });
      setImportSuccessCount(res.count);
      setParsedRows([]);
      setCsvContent("");
      setFileName("");
      setHasProcessed(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to import routine records.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <button
              onClick={onBackToManager}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 mb-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Routine Manager
            </button>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Import Routine from CSV
              </h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Bulk upload routine schedule rows with automated entity resolution and conflict
              verification before database commit.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadSample}
              className="text-xs text-slate-700 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Load Sample CSV
            </Button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {importSuccessCount !== null && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs font-semibold">
                Successfully imported {importSuccessCount} routine entries into the schedule!
              </div>
            </div>
            <Button
              size="sm"
              onClick={onBackToManager}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              View in Routine Table
            </Button>
          </div>
        )}

        {/* Target Academic Scope */}
        <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
              1. Target Department *
            </Label>
            <select
              value={selectedDeptId}
              onChange={(e) => {
                setSelectedDeptId(e.target.value);
                setSelectedSemId("");
              }}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="" disabled>
                Select Department for this CSV batch
              </option>
              {departments.map((d: Department) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
              2. Target Semester *
            </Label>
            <select
              value={selectedSemId}
              disabled={!selectedDeptId}
              onChange={(e) => setSelectedSemId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
            >
              <option value="" disabled>
                Select Semester
              </option>
              {semesters.map((s: Semester) => (
                <option key={s.id} value={s.id}>
                  Sem {s.number} - {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Upload Box */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
            3. Upload or Paste CSV Data
          </Label>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <label className="flex-1 w-full border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/20">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <UploadCloud className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <span className="text-xs font-medium text-slate-700">
                {fileName ? fileName : "Click to browse or drop CSV file"}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Expected header: section,course,faculty,room,day,start,end
              </span>
            </label>

            <Button
              size="sm"
              disabled={!csvContent.trim() || !selectedDeptId || !selectedSemId}
              onClick={handleProcessCsv}
              className="h-14 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1.5 shrink-0"
            >
              <FileText className="w-4 h-4" />
              Verify & Preview CSV
            </Button>
          </div>

          {/* Text Area for manual paste */}
          <div className="mt-3">
            <textarea
              rows={4}
              value={csvContent}
              onChange={(e) => {
                setCsvContent(e.target.value);
                setHasProcessed(false);
              }}
              placeholder="section,course,faculty,room,day,start,end&#10;A,CSE1101,MHA,301,Sunday,09:30,10:50"
              className="w-full rounded-lg border border-slate-200 p-2.5 font-mono text-xs text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Verification & Preview Results */}
      {hasProcessed && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          {/* Summary Metric Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Import Preview & Validation</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review verified rows and resolve any conflicts or missing references before
                committing.
              </p>
            </div>

            {/* Action Button */}
            <div>
              <Button
                size="sm"
                disabled={validRows.length === 0 || isImporting}
                onClick={handleConfirmImport}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isImporting
                  ? "Importing..."
                  : `Confirm & Import ${validRows.length} Valid Entries`}
              </Button>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "all"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Rows ({parsedRows.length})
            </button>
            <button
              onClick={() => setActiveTab("valid")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === "valid"
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Valid & Ready ({validRows.length})
            </button>
            <button
              onClick={() => setActiveTab("issues")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === "issues"
                  ? "bg-rose-600 text-white"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100"
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Issues / Conflicts ({issuesRows.length})
            </button>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Section</th>
                  <th className="py-2.5 px-3">Course</th>
                  <th className="py-2.5 px-3">Faculty</th>
                  <th className="py-2.5 px-3">Room</th>
                  <th className="py-2.5 px-3">Day & Time</th>
                  <th className="py-2.5 px-3">Details / Resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedRows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={
                      row.status === "valid"
                        ? "hover:bg-emerald-50/20"
                        : "bg-rose-50/30 hover:bg-rose-50/50"
                    }
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                      {row.rowNumber}
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {row.status === "valid" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          Ready
                        </span>
                      ) : row.status === "conflict" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                          <AlertTriangle className="w-3 h-3" />
                          Conflict
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                          <AlertCircle className="w-3 h-3" />
                          Invalid
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {row.sectionName || "—"}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {row.courseCode || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{row.facultyShort || "TBA"}</td>
                    <td className="py-2.5 px-3 text-slate-700">{row.roomNumber || "TBA"}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {row.dayString} · {row.startTime}–{row.endTime}
                    </td>

                    <td className="py-2.5 px-3 text-xs">
                      {row.message ? (
                        <span className="text-rose-700 font-medium">{row.message}</span>
                      ) : (
                        <span className="text-emerald-700 font-medium">Valid schedule slot</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
