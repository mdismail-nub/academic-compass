import type { RoutineEntryDetailed } from "./types";

export interface RoutineConflictResult {
  hasConflict: boolean;
  conflictType?: "section" | "room" | "faculty" | "time";
  message?: string;
  conflictingEntry?: RoutineEntryDetailed;
}

/** Convert time string "HH:mm" or "HH:mm:ss" to minutes from midnight */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(":").map((v) => parseInt(v, 10));
  return (hours || 0) * 60 + (minutes || 0);
}

export const parseTimeToMinutes = timeStringToMinutes;

/** Check if two time intervals overlap (strictly: startA < endB && startB < endA) */
export function doIntervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const aStart = timeStringToMinutes(startA);
  const aEnd = timeStringToMinutes(endA);
  const bStart = timeStringToMinutes(startB);
  const bEnd = timeStringToMinutes(endB);

  return aStart < bEnd && bStart < aEnd;
}

export interface CheckConflictParams {
  existingEntries: RoutineEntryDetailed[];
  currentEntryId?: string | null;
  sectionId: string;
  courseId: string;
  facultyId?: string | null;
  roomId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

/**
 * Validate routine time order and check for room, faculty, and section schedule conflicts.
 */
export function checkRoutineConflict({
  existingEntries,
  currentEntryId,
  sectionId,
  facultyId,
  roomId,
  dayOfWeek,
  startTime,
  endTime,
}: CheckConflictParams): RoutineConflictResult {
  const startMins = timeStringToMinutes(startTime);
  const endMins = timeStringToMinutes(endTime);

  // Time sequence validation
  if (startMins >= endMins) {
    return {
      hasConflict: true,
      conflictType: "time",
      message: "End time must be after start time.",
    };
  }

  // Filter entries to the same day, excluding the entry currently being edited
  const sameDayEntries = existingEntries.filter(
    (entry) => entry.day_of_week === dayOfWeek && entry.id !== currentEntryId,
  );

  for (const entry of sameDayEntries) {
    const overlaps = doIntervalsOverlap(startTime, endTime, entry.start_time, entry.end_time);
    if (!overlaps) continue;

    // 1. Section Conflict: Same section cannot have two classes at the same time
    if (entry.section_id === sectionId) {
      const courseName = entry.course?.course_code || "another class";
      return {
        hasConflict: true,
        conflictType: "section",
        message: `Section conflict: Section already has ${courseName} from ${entry.start_time.slice(0, 5)} to ${entry.end_time.slice(0, 5)}.`,
        conflictingEntry: entry,
      };
    }

    // 2. Room Conflict: Same room cannot be occupied by multiple classes
    if (roomId && entry.room_id === roomId) {
      const roomNum = entry.room?.room_number || "Selected room";
      const courseName = entry.course?.course_code || "another class";
      return {
        hasConflict: true,
        conflictType: "room",
        message: `Room conflict: Room ${roomNum} is already occupied by ${courseName} (${entry.start_time.slice(0, 5)} - ${entry.end_time.slice(0, 5)}).`,
        conflictingEntry: entry,
      };
    }

    // 3. Faculty Conflict: Same instructor cannot be assigned to two classes simultaneously
    if (facultyId && entry.faculty_id === facultyId) {
      const facultyName = entry.faculty?.short_name || entry.faculty?.name || "Instructor";
      const courseName = entry.course?.course_code || "another class";
      return {
        hasConflict: true,
        conflictType: "faculty",
        message: `Faculty conflict: ${facultyName} is already teaching ${courseName} (${entry.start_time.slice(0, 5)} - ${entry.end_time.slice(0, 5)}).`,
        conflictingEntry: entry,
      };
    }
  }

  return { hasConflict: false };
}
