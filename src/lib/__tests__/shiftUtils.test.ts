import { describe, it, expect } from "vitest";
import {
  getShiftStart,
  getShiftEnd,
  getCurrentShiftDate,
  SHIFT_START_HOUR,
} from "../shiftUtils";

describe("shiftUtils", () => {
  it("uses 12 PM (mediodía) as shift start hour", () => {
    expect(SHIFT_START_HOUR).toBe(12);
  });

  it("calculates shift start when time is after 12:00 PM on same day", () => {
    const testDate = new Date("2026-08-18T15:30:00");
    const shiftStart = getShiftStart(testDate);
    expect(shiftStart.getHours()).toBe(12);
    expect(shiftStart.getMinutes()).toBe(0);
    expect(shiftStart.getDate()).toBe(18);
  });

  it("calculates shift start when time is before 12:00 PM as previous day", () => {
    const testDate = new Date("2026-08-18T03:30:00");
    const shiftStart = getShiftStart(testDate);
    expect(shiftStart.getHours()).toBe(12);
    expect(shiftStart.getMinutes()).toBe(0);
    expect(shiftStart.getDate()).toBe(17);
  });

  it("calculates shift end as exactly 24 hours after shift start", () => {
    const testDate = new Date("2026-08-18T18:00:00");
    const start = getShiftStart(testDate);
    const end = getShiftEnd(testDate);
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBe(24);
  });

  it("returns base calendar date for active shift (before noon -> previous day, after noon -> current day)", () => {
    // Early morning after midnight (e.g. 2:00 AM)
    const earlyMorning = new Date("2026-08-27T02:00:00");
    const shiftDateEarly = getCurrentShiftDate(earlyMorning);
    expect(shiftDateEarly.getDate()).toBe(26);
    expect(shiftDateEarly.getHours()).toBe(0);

    // Afternoon (e.g. 3:00 PM)
    const afternoon = new Date("2026-08-27T15:00:00");
    const shiftDateAfternoon = getCurrentShiftDate(afternoon);
    expect(shiftDateAfternoon.getDate()).toBe(27);
    expect(shiftDateAfternoon.getHours()).toBe(0);
  });
});
