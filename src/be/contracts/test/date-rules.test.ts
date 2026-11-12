import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptedStandupDates, assertValidStandupDate, standupActivityWindow, standupActivityWindowFor } from "../src/date-rules.js";

const instant = (value: string) => new Date(value);

test("F5/E23 Friday accepts Friday or the following Monday", () => assert.deepEqual(acceptedStandupDates(instant("2026-11-06T10:00:00+08:00")), ["2026-11-06", "2026-11-09"]));
test("F5/E23 Saturday and Sunday accept the weekend date or Monday", () => {
  assert.deepEqual(acceptedStandupDates(instant("2026-11-07T10:00:00+08:00")), ["2026-11-07", "2026-11-09"]);
  assert.deepEqual(acceptedStandupDates(instant("2026-11-08T10:00:00+08:00")), ["2026-11-08", "2026-11-09"]);
});
test("F5/E23 Monday through Thursday accept today or the next calendar day", () => assert.deepEqual(acceptedStandupDates(instant("2026-11-02T10:00:00+08:00")), ["2026-11-02", "2026-11-03"]));
test("F5/E24 Singapore midnight and malformed dates are deterministic", () => {
  const now = instant("2026-11-01T16:00:00Z");
  assert.equal(assertValidStandupDate(undefined, now), "2026-11-02");
  assert.throws(() => assertValidStandupDate("2026-02-30", now), /VALIDATION_FAILED/);
  assert.throws(() => assertValidStandupDate("2026-11-05", now), /VALIDATION_FAILED/);
});
test("F5/E24 future Monday does not move the AD-44 activity-window end", () => {
  const now = instant("2026-11-06T10:00:00+08:00");
  assert.equal(standupActivityWindow(now).to.getTime(), now.getTime());
});
test("E23 Monday-Thursday: the window for tomorrow starts at 00:00 today (SGT)", () => {
  const now = instant("2026-11-10T10:00:00+08:00");
  assert.equal(standupActivityWindowFor("2026-11-11", now).from.getTime(), instant("2026-11-10T00:00:00+08:00").getTime());
  assert.equal(standupActivityWindowFor("2026-11-11", now).to, now);
});
test("E24 Friday, Saturday, Sunday: the window for Monday starts Friday 00:00 (SGT)", () => {
  for (const day of ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"]) {
    assert.equal(standupActivityWindowFor("2026-11-16", instant(`${day}T10:00:00+08:00`)).from.getTime(), instant("2026-11-13T00:00:00+08:00").getTime());
  }
});
test("E76 now at 00:00 SGT with tomorrow's date gives an empty window", () => {
  const now = instant("2026-11-10T00:00:00+08:00");
  assert.equal(standupActivityWindowFor("2026-11-11", now).from.getTime(), now.getTime());
});
