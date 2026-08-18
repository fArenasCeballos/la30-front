import { describe, it, expect } from "vitest";
import { getShiftStart, getShiftEnd, SHIFT_START_HOUR } from "../shiftUtils";

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
});
