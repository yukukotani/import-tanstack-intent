import { describe, expect, it } from "vite-plus/test";
import type { ImportCandidate } from "./importer.ts";
import { toSelectableSkill } from "./selection.ts";

function candidate(overrides: Partial<ImportCandidate["skill"]> = {}): ImportCandidate {
  return {
    destinationName: "core",
    skill: {
      description: "Core fixture",
      packageName: "fake-intent-package",
      packageRoot: "/tmp/fake-intent-package",
      packageSource: "local",
      packageVersion: "1.0.0",
      skillName: "core",
      type: "core",
      use: "fake-intent-package#core",
      ...overrides,
    },
    subSkills: [],
  };
}

describe("toSelectableSkill", () => {
  it("includes the Intent skill type in the selection label", () => {
    expect(toSelectableSkill(candidate()).label).toBe("core [core]");
    expect(toSelectableSkill(candidate({ skillName: "react", type: "framework" })).label).toBe(
      "react [framework]",
    );
  });
});
