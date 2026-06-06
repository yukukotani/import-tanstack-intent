import * as p from "@clack/prompts";
import pc from "picocolors";
import type { ImportCandidate } from "./importer.ts";

export interface SelectableSkill {
  value: string;
  label: string;
  hint?: string;
}

export interface SelectImportCandidatesResult {
  cancelled: boolean;
  selectedUses: string[];
}

export type MultiselectPrompt = (options: {
  message: string;
  options: SelectableSkill[];
  required: boolean;
}) => Promise<string[] | symbol>;

export function toSelectableSkill(candidate: ImportCandidate): SelectableSkill {
  const subSkillHint =
    candidate.subSkills.length > 0 ? `, ${candidate.subSkills.length} bundled reference(s)` : "";
  const hint = `${candidate.skill.packageName}@${candidate.skill.packageVersion}${subSkillHint}`;
  return {
    value: candidate.skill.use,
    label: candidate.skill.skillName,
    hint,
  };
}

export function sortImportCandidates(candidates: ImportCandidate[]): ImportCandidate[] {
  return [...candidates].sort((left, right) =>
    left.skill.skillName.localeCompare(right.skill.skillName),
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

export async function selectImportCandidates(options: {
  candidates: ImportCandidate[];
  prompt?: MultiselectPrompt;
}): Promise<SelectImportCandidatesResult> {
  const prompt = options.prompt ?? defaultMultiselectPrompt;
  const choices = sortImportCandidates(options.candidates).map(toSelectableSkill);
  const selected = await prompt({
    message: "Select TanStack Intent skills to import",
    options: choices,
    required: true,
  });

  if (isPromptCancel(selected)) {
    return { cancelled: true, selectedUses: [] };
  }

  return { cancelled: false, selectedUses: selected };
}
