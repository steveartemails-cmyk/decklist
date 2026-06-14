// Unit tests for the conflict math. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  timeToMinutes,
  gigToInterval,
  intervalsOverlap,
  gigsConflict,
  expandOccurrences,
  findConflicts,
} from "./scheduling.js";

const gig = (date, startTime, endTime, extra = {}) => ({
  id: Math.random().toString(36).slice(2),
  date,
  startTime,
  endTime,
  ...extra,
});

test("timeToMinutes parses 24h times", () => {
  assert.equal(timeToMinutes("00:00"), 0);
  assert.equal(timeToMinutes("14:30"), 870);
  assert.equal(timeToMinutes("23:59"), 1439);
});

test("a set crossing midnight ends on the next day", () => {
  const { start, end } = gigToInterval(gig("2026-06-14", "23:00", "03:00"));
  assert.equal(end - start, 240); // 4 hours
  assert.ok(end > start);
});

test("intervalsOverlap is half-open (touching is not overlap)", () => {
  assert.equal(intervalsOverlap({ start: 0, end: 10 }, { start: 10, end: 20 }), false);
  assert.equal(intervalsOverlap({ start: 0, end: 11 }, { start: 10, end: 20 }), true);
});

test("overlapping sets on the same night conflict", () => {
  const a = gig("2026-06-14", "21:00", "23:00");
  const b = gig("2026-06-14", "22:00", "23:30");
  assert.equal(gigsConflict(a, b), true);
});

test("back-to-back sets do NOT conflict", () => {
  const a = gig("2026-06-14", "20:00", "22:00");
  const b = gig("2026-06-14", "22:00", "23:30");
  assert.equal(gigsConflict(a, b), false);
});

test("a midnight-crossing set conflicts with an early set the next morning", () => {
  const lateNight = gig("2026-06-14", "23:00", "03:00"); // ends 2026-06-15 03:00
  const earlyNext = gig("2026-06-15", "02:00", "05:00");
  assert.equal(gigsConflict(lateNight, earlyNext), true);
});

test("gigs on different nights don't conflict", () => {
  const a = gig("2026-06-14", "21:00", "23:00");
  const b = gig("2026-06-15", "21:00", "23:00");
  assert.equal(gigsConflict(a, b), false);
});

test("gigs missing a date or time are never schedulable", () => {
  const a = gig("2026-06-14", "21:00", "23:00");
  const incomplete = gig("2026-06-14", "", "23:00");
  assert.equal(gigsConflict(a, incomplete), false);
});

test("expandOccurrences yields one occurrence for a one-off gig", () => {
  const occ = expandOccurrences(gig("2026-06-14", "21:00", "23:00"));
  assert.equal(occ.length, 1);
});

test("weekly recurrence with a count expands to that many occurrences", () => {
  const weekly = gig("2026-06-14", "21:00", "23:00", {
    recurrence: { freq: "weekly", count: 4 },
  });
  const occ = expandOccurrences(weekly);
  assert.equal(occ.length, 4);
  assert.deepEqual(
    occ.map((o) => o.date),
    ["2026-06-14", "2026-06-21", "2026-06-28", "2026-07-05"],
  );
});

test("recurrence stops at the `until` date", () => {
  const weekly = gig("2026-06-14", "21:00", "23:00", {
    recurrence: { freq: "weekly", until: "2026-06-28" },
  });
  const occ = expandOccurrences(weekly);
  assert.deepEqual(
    occ.map((o) => o.date),
    ["2026-06-14", "2026-06-21", "2026-06-28"],
  );
});

test("findConflicts skips the gig's own id (editing in place is safe)", () => {
  const a = gig("2026-06-14", "21:00", "23:00");
  const existing = [a];
  const edited = { ...a, endTime: "23:30" };
  assert.deepEqual(findConflicts(edited, existing), []);
});

test("findConflicts finds a clash against a weekly residency occurrence", () => {
  const residency = gig("2026-06-07", "22:00", "02:00", {
    recurrence: { freq: "weekly", count: 8 },
  });
  // Lands on the 2026-06-21 occurrence of the residency.
  const oneOff = gig("2026-06-21", "23:00", "01:00");
  const conflicts = findConflicts(oneOff, [residency]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].id, residency.id);
});

test("findConflicts returns the stored gig once even with multiple clashing occurrences", () => {
  const residency = gig("2026-06-07", "22:00", "23:00", {
    recurrence: { freq: "weekly", count: 8 },
  });
  const everyWeek = gig("2026-06-07", "22:15", "22:45", {
    recurrence: { freq: "weekly", count: 8 },
  });
  const conflicts = findConflicts(everyWeek, [residency]);
  assert.equal(conflicts.length, 1);
});
