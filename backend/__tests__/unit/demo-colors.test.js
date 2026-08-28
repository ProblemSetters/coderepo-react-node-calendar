import { demoProfileColors } from "../../src/shared/constants/demo-colors.js";

describe("demo identity colors", () => {
    test("keeps every profile distinct and each secondary calendar separate from its owner", () => {
        const assignments = Object.values(demoProfileColors);
        expect(new Set(assignments.map((assignment) => assignment.profile)).size).toBe(assignments.length);
        assignments.forEach((assignment) => expect(assignment.work).not.toBe(assignment.profile));
        expect(demoProfileColors["mahadevan@example.com"].Birthdays).not.toBe(demoProfileColors["mahadevan@example.com"].profile);
        expect(demoProfileColors["mahadevan@example.com"].Birthdays).not.toBe(demoProfileColors["mahadevan@example.com"].work);
    });
});
