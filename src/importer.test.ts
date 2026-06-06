import type { IntentSkillList, ResolvedIntentSkill } from "@tanstack/intent/core";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  ImportTanStackIntentError,
  createImportCandidates,
  importSelectedSkills,
  listImportCandidates,
  runImport,
  slugifySkillName,
  type IntentCoreApi,
} from "./importer.ts";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function createIntentFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "import-tanstack-intent-"));
  temporaryRoots.push(cwd);

  await writeJson(join(cwd, "package.json"), {
    name: "fixture-project",
    version: "1.0.0",
    dependencies: {
      "fake-intent-package": "1.0.0",
    },
  });

  const packageRoot = join(cwd, "node_modules", "fake-intent-package");
  await mkdir(join(packageRoot, "skills", "core", "deep"), { recursive: true });
  await writeJson(join(packageRoot, "package.json"), {
    name: "fake-intent-package",
    version: "1.0.0",
    intent: {
      version: 1,
      repo: "owner/repo",
      docs: "https://example.test/docs",
    },
  });

  await writeFile(
    join(packageRoot, "skills", "core", "SKILL.md"),
    `---\nname: core\ndescription: Core fixture skill\ntype: core\n---\n\n# Core Skill\n\nSee [deep](deep/SKILL.md).\n`,
    "utf8",
  );
  await writeFile(
    join(packageRoot, "skills", "core", "deep", "SKILL.md"),
    `---\nname: core/deep\ndescription: Deep reference\ntype: sub-skill\n---\n\n# Deep Reference\n`,
    "utf8",
  );

  return cwd;
}

function minimalList(skills: IntentSkillList["skills"]): IntentSkillList {
  return {
    packageManager: "unknown",
    skills,
    packages: [],
    warnings: [],
    conflicts: [],
  } as IntentSkillList;
}

function resolvedSkill(skillName: string, path: string): ResolvedIntentSkill {
  return {
    conflict: null,
    packageName: "fake-intent-package",
    packageRoot: "/tmp/fake-intent-package",
    path,
    skillName,
    source: "local",
    version: "1.0.0",
    warnings: [],
  } as ResolvedIntentSkill;
}

describe("slugifySkillName", () => {
  it("converts Intent skill names into flat safe path stems", () => {
    expect(slugifySkillName("core/deep topic")).toBe("core-deep-topic");
    expect(slugifySkillName("../core")).toBe("core");
  });
});

describe("createImportCandidates", () => {
  it("keeps only core skills and attaches prefix-matched sub-skills", () => {
    const list = minimalList([
      {
        description: "Core",
        packageName: "pkg",
        packageRoot: "/tmp/pkg",
        packageSource: "local",
        packageVersion: "1.0.0",
        skillName: "core",
        type: "core",
        use: "pkg#core",
      },
      {
        description: "Sub",
        packageName: "pkg",
        packageRoot: "/tmp/pkg",
        packageSource: "local",
        packageVersion: "1.0.0",
        skillName: "core/sub",
        type: "sub-skill",
        use: "pkg#core/sub",
      },
      {
        description: "Framework",
        framework: "react",
        packageName: "pkg",
        packageRoot: "/tmp/pkg",
        packageSource: "local",
        packageVersion: "1.0.0",
        skillName: "react",
        type: "framework",
        use: "pkg#react",
      },
    ]);

    expect(createImportCandidates(list)).toMatchObject([
      {
        destinationName: "core",
        skill: { use: "pkg#core" },
        subSkills: [{ use: "pkg#core/sub" }],
      },
    ]);
  });

  it("fails when two core skills slug to the same destination", () => {
    const list = minimalList([
      {
        description: "One",
        packageName: "pkg",
        packageRoot: "/tmp/pkg",
        packageSource: "local",
        packageVersion: "1.0.0",
        skillName: "foo/bar",
        type: "core",
        use: "pkg#foo/bar",
      },
      {
        description: "Two",
        packageName: "pkg",
        packageRoot: "/tmp/pkg",
        packageSource: "local",
        packageVersion: "1.0.0",
        skillName: "foo bar",
        type: "core",
        use: "pkg#foo bar",
      },
    ]);

    expect(() => createImportCandidates(list)).toThrow(ImportTanStackIntentError);
  });

  it("fails when duplicate entries repeat the same destination and use", () => {
    const duplicate: IntentSkillList["skills"][number] = {
      description: "One",
      packageName: "pkg",
      packageRoot: "/tmp/pkg",
      packageSource: "local",
      packageVersion: "1.0.0",
      skillName: "core",
      type: "core",
      use: "pkg#core",
    };

    expect(() => createImportCandidates(minimalList([duplicate, duplicate]))).toThrow(
      ImportTanStackIntentError,
    );
  });
});

describe("importSelectedSkills", () => {
  it("recomputes destination names from skill names before writing", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "import-tanstack-intent-"));
    temporaryRoots.push(cwd);
    const selected = createImportCandidates(
      minimalList([
        {
          description: "Core",
          packageName: "pkg",
          packageRoot: "/tmp/pkg",
          packageSource: "local",
          packageVersion: "1.0.0",
          skillName: "core",
          type: "core",
          use: "pkg#core",
        },
      ]),
    )[0]!;
    selected.destinationName = "../outside";
    const sourceDir = join(cwd, "source", "core");
    const sourcePath = join(sourceDir, "SKILL.md");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(sourcePath, "# Core", "utf8");
    const api: IntentCoreApi = {
      listIntentSkills: vi.fn(() => minimalList([])),
      resolveIntentSkill: vi.fn(() => resolvedSkill("core", sourcePath)),
    };

    const result = await importSelectedSkills({
      api,
      candidates: [selected],
      cwd,
      selectedUses: [selected.skill.use],
    });

    expect(result.skills[0]?.destinationName).toBe("core");
    expect(existsSync(join(cwd, ".agents", "skills", "core", "SKILL.md"))).toBe(true);
    expect(existsSync(join(cwd, ".agents", "outside", "SKILL.md"))).toBe(false);
  });
});

describe("listImportCandidates", () => {
  it("uses @tanstack/intent/core discovery and maps sub-skills from a fixture package", async () => {
    const cwd = await createIntentFixture();

    const listed = listImportCandidates({ cwd });

    expect(listed.candidates).toHaveLength(1);
    expect(listed.candidates[0]).toMatchObject({
      destinationName: "core",
      skill: { skillName: "core", type: "core" },
      subSkills: [{ skillName: "core/deep", type: "sub-skill" }],
    });
  });
});

describe("runImport", () => {
  it("writes selected core skills and bundled sub-skill references", async () => {
    const cwd = await createIntentFixture();
    const listed = listImportCandidates({ cwd });
    const selectedUse = listed.candidates[0]!.skill.use;
    await mkdir(join(cwd, ".agents", "skills", "core"), { recursive: true });
    await writeFile(join(cwd, ".agents", "skills", "core", "old.txt"), "old", "utf8");

    const summary = await runImport({ cwd, selectedUses: [selectedUse] });

    expect(summary).toMatchObject({ importedCount: 1, overwriteCount: 1 });
    const skillPath = join(cwd, ".agents", "skills", "core", "SKILL.md");
    const referencePath = join(cwd, ".agents", "skills", "core", "references", "core-deep.md");
    const skillContent = await readFile(skillPath, "utf8");
    expect(skillContent).not.toContain("## Bundled TanStack Intent References");
    expect(skillContent).toContain("(references/core-deep.md)");
    await expect(readFile(referencePath, "utf8")).resolves.toContain("# Deep Reference");
    expect(existsSync(join(cwd, ".agents", "skills", "core", "old.txt"))).toBe(false);
    expect(existsSync(join(cwd, ".agents", "skills", "core-deep", "SKILL.md"))).toBe(false);
  });

  it("fails with diagnostics when no core skills are importable", async () => {
    const resolveIntentSkillMock = vi.fn(() => resolvedSkill("core", "/tmp/unused/SKILL.md"));
    const api: IntentCoreApi = {
      listIntentSkills: vi.fn(
        () =>
          ({
            packageManager: "unknown",
            skills: [],
            packages: [],
            warnings: ["fixture warning"],
            conflicts: [],
          }) as IntentSkillList,
      ),
      resolveIntentSkill: resolveIntentSkillMock,
    };

    await expect(runImport({ api, selectedUses: ["pkg#core"] })).rejects.toMatchObject({
      code: "no-core-skills",
      message: expect.stringContaining("fixture warning"),
    });
    expect(resolveIntentSkillMock).not.toHaveBeenCalled();
  });
});
