import type { IntentSkillList } from "@tanstack/intent/core";
import { describe, expect, it, vi } from "vite-plus/test";
import { main, runImportCommand, type CliDependencies, type WritableLike } from "./cli.ts";
import type { ImportCandidate, ImportSummary } from "./importer.ts";

type OutputCapture = WritableLike & { chunks: string[] };

function capture(): OutputCapture {
  return {
    chunks: [],
    write(chunk: string) {
      this.chunks.push(chunk);
      return true;
    },
  };
}

function minimalList(): IntentSkillList {
  return {
    packageManager: "unknown",
    skills: [],
    packages: [],
    warnings: [],
    conflicts: [],
  } as IntentSkillList;
}

function candidate(): ImportCandidate {
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
    },
    subSkills: [],
  };
}

function summary(): ImportSummary {
  return {
    diagnostics: [],
    importedCount: 1,
    overwriteCount: 0,
    skills: [
      {
        destinationName: "core",
        destinationPath: "/tmp/project/.agents/skills/core",
        overwritten: false,
        referenceCount: 0,
        skillName: "core",
        use: "fake-intent-package#core",
      },
    ],
  };
}

describe("main", () => {
  it("returns 0 for Gunshi help without loading importer modules", async () => {
    const deps: CliDependencies = {
      loadImporter: vi.fn(async () => {
        throw new Error("should not load importer for help");
      }),
    };

    await expect(main(["--help"], deps)).resolves.toBe(0);
    expect(deps.loadImporter).not.toHaveBeenCalled();
  });
});

describe("runImportCommand", () => {
  it("prints diagnostics and returns 1 when no core skills are available", async () => {
    const stdout = capture();
    const stderr = capture();
    const importSelectedSkills = vi.fn(async () => summary());
    const deps: CliDependencies = {
      io: { stderr, stdout },
      loadImporter: vi.fn(
        async () =>
          ({
            createNoCoreSkillsError: () =>
              new Error(
                "No importable TanStack Intent core skills were found.\n\nWarning: fixture",
              ),
            importSelectedSkills,
            listImportCandidates: () => ({
              candidates: [],
              diagnostics: ["Warning: fixture"],
              list: { ...minimalList(), warnings: ["fixture"] },
            }),
          }) as never,
      ),
      loadSelection: vi.fn(async () => {
        throw new Error("selection should not be loaded");
      }),
    };

    await expect(runImportCommand(deps)).resolves.toBe(1);
    expect(stderr.chunks.join("")).toContain("No importable TanStack Intent core skills");
    expect(importSelectedSkills).not.toHaveBeenCalled();
    expect(deps.loadSelection).not.toHaveBeenCalled();
  });

  it("imports selected skills and prints a concise summary", async () => {
    const stdout = capture();
    const stderr = capture();
    const selectedCandidate = candidate();
    const importSelectedSkills = vi.fn(async () => summary());
    const deps: CliDependencies = {
      cwd: "/tmp/project",
      io: { stderr, stdout },
      loadImporter: vi.fn(
        async () =>
          ({
            createNoCoreSkillsError: () => new Error("unused"),
            importSelectedSkills,
            listImportCandidates: () => ({
              candidates: [selectedCandidate],
              diagnostics: [],
              list: minimalList(),
            }),
          }) as never,
      ),
      loadSelection: vi.fn(
        async () =>
          ({
            selectImportCandidates: vi.fn(async () => ({
              cancelled: false,
              selectedUses: [selectedCandidate.skill.use],
            })),
          }) as never,
      ),
    };

    await expect(runImportCommand(deps)).resolves.toBe(0);
    expect(importSelectedSkills).toHaveBeenCalledWith({
      candidates: [selectedCandidate],
      cwd: "/tmp/project",
      diagnostics: [],
      selectedUses: [selectedCandidate.skill.use],
    });
    expect(stdout.chunks.join("")).toContain("Imported 1 skill.");
    expect(stdout.chunks.join("")).toContain(".agents/skills/core");
  });
});
