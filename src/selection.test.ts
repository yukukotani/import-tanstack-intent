import { describe, expect, it, vi } from "vite-plus/test";
import type { ImportCandidate } from "./importer.ts";
import {
  selectImportCandidates,
  toSelectableAgent,
  toSelectableSkill,
  type AgentMultiselectPrompt,
  type MultiselectPrompt,
} from "./selection.ts";

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

describe("toSelectableAgent", () => {
  it("includes agent display names and destination hints in target choices", () => {
    expect(toSelectableAgent("claude-code")).toEqual({
      value: "claude-code",
      label: "Claude Code",
      hint: ".claude/skills",
    });
    expect(toSelectableAgent("codex")).toMatchObject({ label: "Codex", hint: ".agents/skills" });
  });
});

describe("selectImportCandidates", () => {
  it("prompts for skills before prompting for agents", async () => {
    const calls: string[] = [];
    const selectedCandidate = candidate();
    const agentPrompt: AgentMultiselectPrompt = async () => {
      calls.push("agents");
      return ["claude-code"];
    };
    const skillPrompt: MultiselectPrompt = async () => {
      calls.push("skills");
      return [selectedCandidate.skill.use];
    };

    await expect(
      selectImportCandidates({ candidates: [selectedCandidate], agentPrompt, skillPrompt }),
    ).resolves.toEqual({
      cancelled: false,
      selectedUses: [selectedCandidate.skill.use],
      targetAgents: ["universal", "claude-code"],
    });
    expect(calls).toEqual(["skills", "agents"]);
  });

  it("offers only additional non-.agents/skills agents", async () => {
    const selectedCandidate = candidate();
    const agentPrompt: AgentMultiselectPrompt = async ({ options, required }) => {
      expect(required).toBe(false);
      expect(options.map((option) => option.value)).toContain("claude-code");
      expect(options.map((option) => option.value)).not.toContain("codex");
      expect(options.map((option) => option.value)).not.toContain("universal");
      return [];
    };

    await expect(
      selectImportCandidates({
        candidates: [selectedCandidate],
        agentPrompt,
        skillPrompt: async () => [selectedCandidate.skill.use],
      }),
    ).resolves.toEqual({
      cancelled: false,
      selectedUses: [selectedCandidate.skill.use],
      targetAgents: ["universal"],
    });
  });

  it("cancels before agent selection when the skill prompt is cancelled", async () => {
    const cancel = Symbol("cancel");
    const agentPrompt = vi.fn<AgentMultiselectPrompt>();

    await expect(
      selectImportCandidates({
        candidates: [candidate()],
        agentPrompt,
        skillPrompt: async () => cancel,
      }),
    ).resolves.toEqual({ cancelled: true, selectedUses: [], targetAgents: [] });
    expect(agentPrompt).not.toHaveBeenCalled();
  });

  it("cancels after skill selection when the target-agent prompt is cancelled", async () => {
    const cancel = Symbol("cancel");
    const selectedCandidate = candidate();

    await expect(
      selectImportCandidates({
        candidates: [selectedCandidate],
        agentPrompt: async () => cancel,
        skillPrompt: async () => [selectedCandidate.skill.use],
      }),
    ).resolves.toEqual({ cancelled: true, selectedUses: [], targetAgents: [] });
  });
});
