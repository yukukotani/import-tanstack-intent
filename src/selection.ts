import * as p from "@clack/prompts";
import pc from "picocolors";
import { agents, defaultTargetAgents, getAdditionalAgentTypes, type AgentType } from "./agents.ts";
import type { ImportCandidate } from "./importer.ts";

export interface SelectableSkill {
  value: string;
  label: string;
  hint?: string;
}

export interface SelectableAgent {
  value: AgentType;
  label: string;
  hint?: string;
}

export interface SelectImportCandidatesResult {
  cancelled: boolean;
  selectedUses: string[];
  targetAgents: AgentType[];
}

export type MultiselectPrompt = (options: {
  message: string;
  options: SelectableSkill[];
  required: boolean;
}) => Promise<string[] | symbol>;

export type AgentMultiselectPrompt = (options: {
  message: string;
  options: SelectableAgent[];
  required: boolean;
}) => Promise<AgentType[] | symbol>;

export function toSelectableSkill(candidate: ImportCandidate): SelectableSkill {
  const subSkillHint =
    candidate.subSkills.length > 0 ? `, ${candidate.subSkills.length} bundled reference(s)` : "";
  const hint = `${candidate.skill.packageName}@${candidate.skill.packageVersion}${subSkillHint}`;
  return {
    value: candidate.skill.use,
    label: `${candidate.skill.skillName} [${candidate.skill.type}]`,
    hint,
  };
}

export function toSelectableAgent(agent: AgentType): SelectableAgent {
  const config = agents[agent];
  return {
    value: agent,
    label: config.displayName,
    hint: config.skillsDir,
  };
}

export function sortImportCandidates(candidates: ImportCandidate[]): ImportCandidate[] {
  return [...candidates].sort((left, right) =>
    left.skill.skillName.localeCompare(right.skill.skillName),
  );
}

export function sortAgentTypes(agentTypes: readonly AgentType[]): AgentType[] {
  return [...agentTypes].sort((left, right) =>
    agents[left].displayName.localeCompare(agents[right].displayName),
  );
}

export function isPromptCancel(value: unknown): value is symbol {
  return typeof value === "symbol" || p.isCancel(value);
}

export const defaultMultiselectPrompt: MultiselectPrompt = (options) =>
  p.multiselect({
    ...options,
    message: `${options.message} ${pc.dim("(space to toggle)")}`,
  }) as Promise<string[] | symbol>;

export const defaultAgentMultiselectPrompt: AgentMultiselectPrompt = (options) =>
  p.multiselect<string>({
    ...options,
    message: `${options.message} ${pc.dim("(space to toggle)")}`,
  }) as Promise<AgentType[] | symbol>;

export async function selectImportCandidates(options: {
  candidates: ImportCandidate[];
  prompt?: MultiselectPrompt;
  skillPrompt?: MultiselectPrompt;
  agentPrompt?: AgentMultiselectPrompt;
}): Promise<SelectImportCandidatesResult> {
  const skillPrompt = options.skillPrompt ?? options.prompt ?? defaultMultiselectPrompt;
  const agentPrompt = options.agentPrompt ?? defaultAgentMultiselectPrompt;
  const choices = sortImportCandidates(options.candidates).map(toSelectableSkill);
  const selected = await skillPrompt({
    message: "Select TanStack Intent skills to import",
    options: choices,
    required: true,
  });

  if (isPromptCancel(selected)) {
    return { cancelled: true, selectedUses: [], targetAgents: [] };
  }

  const agentChoices = sortAgentTypes(getAdditionalAgentTypes()).map(toSelectableAgent);
  const selectedAdditionalAgents = await agentPrompt({
    message: "Select additional agents to symlink from .agents/skills",
    options: agentChoices,
    required: false,
  });

  if (isPromptCancel(selectedAdditionalAgents)) {
    return { cancelled: true, selectedUses: [], targetAgents: [] };
  }

  const targetAgents = [...new Set([...defaultTargetAgents, ...selectedAdditionalAgents])];
  return { cancelled: false, selectedUses: selected, targetAgents };
}
