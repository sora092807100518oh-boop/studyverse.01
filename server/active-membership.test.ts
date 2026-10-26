import { describe, expect, it } from "vitest";
import { getActiveMembership, withActiveMembership } from "./active-membership";

describe("active classroom membership", () => {
  it("only supplies the logged-in user's selected membership", () => {
    const selected = { userId: 9, profileId: 20, classroomId: 7 };
    withActiveMembership(selected, () => {
      expect(getActiveMembership(9)).toEqual(selected);
      expect(getActiveMembership(10)).toBeUndefined();
    });
    expect(getActiveMembership(9)).toBeUndefined();
  });
  it("isolates concurrent requests and carries the selection through async work", async () => {
    await Promise.all([7, 8].map(classroomId => withActiveMembership({ userId: 9, profileId: classroomId + 20, classroomId }, async () => {
      await new Promise(resolve => setTimeout(resolve, classroomId));
      expect(getActiveMembership(9)?.classroomId).toBe(classroomId);
    })));
  });
});
