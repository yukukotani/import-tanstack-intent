import {
  listIntentSkills,
  resolveIntentSkill,
  type IntentSkillList,
  type IntentSkillSummary,
  type ResolvedIntentSkill,
} from "@tanstack/intent/core";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve as resolvePath } from "node:path";
import {
  agents,
  defaultTargetAgents,
  resolveImportDestinations,
  type AgentType,
  type ImportDestination,
} from "./agents.ts";

export interface IntentCoreApi {
  listIntentSkills: typeof listIntentSkills;
  resolveIntentSkill: typeof resolveIntentSkill;
}

export interface ImportCandidate {
  skill: IntentSkillSummary;
  destinationName: string;
  subSkills: IntentSkillSummary[];
}

export interface ListedImportCandidates {
  list: IntentSkillList;
  candidates: ImportCandidate[];
  diagnostics: string[];
}

export interface ImportedSkillDestinationSummary {
  agents: AgentType[];
  agentDisplayNames: string[];
  skillsRoot: string;
  destinationPath: string;
  overwritten: boolean;
}

export interface ImportedSkillSummary {
  use: string;
  skillName: string;
  destinationName: string;
  destinationPath: string;
  destinations?: ImportedSkillDestinationSummary[];
  referenceCount: number;
  overwritten: boolean;
}

export interface ImportSummary {
  importedCount: number;
  destinationCount?: number;
  overwriteCount: number;
  skills: ImportedSkillSummary[];
  diagnostics: string[];
}

export type ImportTanStackIntentErrorCode =
  | "destination-collision"
  | "invalid-selection"
  | "no-importable-skills"
  | "unsafe-skill-name";

export class ImportTanStackIntentError extends Error {
  readonly code: ImportTanStackIntentErrorCode;

  constructor(code: ImportTanStackIntentErrorCode, message: string) {
    super(message);
    this.name = "ImportTanStackIntentError";
    this.code = code;
  }
}

export const defaultIntentCoreApi: IntentCoreApi = {
  listIntentSkills,
  resolveIntentSkill,
};

export function isSubSkill(skill: IntentSkillSummary): boolean {
  return skill.type === "sub-skill";
}

export function isCoreSkill(skill: IntentSkillSummary): boolean {
  return skill.type === "core";
}

export function isImportableSkill(skill: IntentSkillSummary): boolean {
  return !isSubSkill(skill);
}

export function slugifySkillName(skillName: string): string {
  return skillName
    .normalize("NFKD")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
}

export function safeSlugForSkill(skillName: string): string {
  const slug = slugifySkillName(skillName);
  if (!slug) {
    throw new ImportTanStackIntentError(
      "unsafe-skill-name",
      `Cannot derive a safe destination name from Intent skill "${skillName}".`,
    );
  }
  return slug;
}

export function findBundledSubSkills(
  parentSkill: IntentSkillSummary,
  allSkills: IntentSkillSummary[],
): IntentSkillSummary[] {
  const prefix = `${parentSkill.skillName}/`;
  return allSkills
    .filter(
      (skill) =>
        skill.packageName === parentSkill.packageName &&
        isSubSkill(skill) &&
        skill.skillName.startsWith(prefix),
    )
    .sort((left, right) => left.skillName.localeCompare(right.skillName));
}

export function formatIntentDiagnostics(
  list: Pick<IntentSkillList, "warnings" | "conflicts">,
): string[] {
  const warnings = list.warnings.map((warning) => `Warning: ${warning}`);
  const conflicts = list.conflicts.map(
    (conflict) =>
      `Conflict: ${conflict.packageName} has multiple installed versions; using ${conflict.chosen.version} at ${conflict.chosen.packageRoot}.`,
  );
  return [...warnings, ...conflicts];
}

export function createImportCandidates(list: IntentSkillList): ImportCandidate[] {
  const seenDestinations = new Map<string, string>();

  return list.skills.filter(isImportableSkill).map((skill) => {
    const destinationName = safeSlugForSkill(skill.skillName);
    const previous = seenDestinations.get(destinationName);
    if (previous) {
      throw new ImportTanStackIntentError(
        "destination-collision",
        `Intent skills "${previous}" and "${skill.use}" both map to destination name "${destinationName}".`,
      );
    }
    seenDestinations.set(destinationName, skill.use);

    return {
      skill,
      destinationName,
      subSkills: findBundledSubSkills(skill, list.skills),
    };
  });
}

export function createNoImportableSkillsError(list: IntentSkillList): ImportTanStackIntentError {
  const diagnostics = formatIntentDiagnostics(list);
  const detail = diagnostics.length > 0 ? `\n\n${diagnostics.join("\n")}` : "";
  return new ImportTanStackIntentError(
    "no-importable-skills",
    `No importable TanStack Intent skills were found.${detail}`,
  );
}

export const createNoCoreSkillsError = createNoImportableSkillsError;

export function listImportCandidates(
  options: {
    cwd?: string;
    api?: IntentCoreApi;
  } = {},
): ListedImportCandidates {
  const api = options.api ?? defaultIntentCoreApi;
  const list = api.listIntentSkills({ cwd: options.cwd });
  const candidates = createImportCandidates(list);
  return {
    list,
    candidates,
    diagnostics: formatIntentDiagnostics(list),
  };
}

function assertKnownSelections(
  selectedUses: string[],
  candidates: ImportCandidate[],
): ImportCandidate[] {
  if (selectedUses.length === 0) {
    throw new ImportTanStackIntentError(
      "invalid-selection",
      "Select at least one skill to import.",
    );
  }

  const byUse = new Map(candidates.map((candidate) => [candidate.skill.use, candidate]));
  const selected: ImportCandidate[] = [];
  for (const use of new Set(selectedUses)) {
    const candidate = byUse.get(use);
    if (!candidate) {
      throw new ImportTanStackIntentError(
        "invalid-selection",
        `Selected skill "${use}" is not an importable TanStack Intent skill.`,
      );
    }
    selected.push(candidate);
  }
  return selected;
}

function assertKnownTargetAgents(targetAgents: readonly string[]): AgentType[] {
  const uniqueAgents = [...new Set(targetAgents)];
  if (uniqueAgents.length === 0) {
    throw new ImportTanStackIntentError(
      "invalid-selection",
      "Select at least one target agent to import into.",
    );
  }

  const invalidAgents = uniqueAgents.filter((agent) => !Object.hasOwn(agents, agent));
  if (invalidAgents.length > 0) {
    throw new ImportTanStackIntentError(
      "invalid-selection",
      `Unknown target agent(s): ${invalidAgents.join(", ")}. Valid agents: ${Object.keys(agents).join(", ")}.`,
    );
  }

  return uniqueAgents as AgentType[];
}

function referenceFileName(skillName: string): string {
  return `${safeSlugForSkill(skillName)}.md`;
}

interface RawIntentSkill extends ResolvedIntentSkill {
  content: string;
}

async function readRawIntentSkill(
  api: IntentCoreApi,
  cwd: string,
  use: string,
): Promise<RawIntentSkill> {
  const resolved = api.resolveIntentSkill(use, { cwd });
  const content = await readFile(resolvePath(cwd, resolved.path), "utf8");
  return { ...resolved, content };
}

function bundledLinkDestinations(
  coreSkill: IntentSkillSummary,
  subSkill: IntentSkillSummary,
): string[] {
  const suffix = subSkill.skillName.startsWith(`${coreSkill.skillName}/`)
    ? subSkill.skillName.slice(coreSkill.skillName.length + 1)
    : subSkill.skillName;
  return [
    `${suffix}/SKILL.md`,
    `./${suffix}/SKILL.md`,
    `${subSkill.skillName}/SKILL.md`,
    `./${subSkill.skillName}/SKILL.md`,
  ];
}

function rewriteBundledReferenceLinks(
  content: string,
  coreSkill: IntentSkillSummary,
  references: Array<{ skill: IntentSkillSummary; fileName: string }>,
): string {
  let rewritten = content;
  for (const reference of references) {
    const localDestination = `references/${reference.fileName}`;
    for (const destination of bundledLinkDestinations(coreSkill, reference.skill)) {
      rewritten = rewritten.replaceAll(destination, localDestination);
    }
  }
  return rewritten;
}

function normalizeTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function referenceMarkdown(loaded: RawIntentSkill): string {
  const content = loaded.content.endsWith("\n") ? loaded.content : `${loaded.content}\n`;
  return `<!-- Imported from TanStack Intent: ${loaded.packageName}#${loaded.skillName} -->\n\n${content}`;
}

function assertUniqueReferenceFiles(
  references: Array<{ skill: IntentSkillSummary; fileName: string }>,
): void {
  const seen = new Map<string, string>();
  for (const reference of references) {
    const previous = seen.get(reference.fileName);
    if (previous && previous !== reference.skill.use) {
      throw new ImportTanStackIntentError(
        "destination-collision",
        `Sub-skills "${previous}" and "${reference.skill.use}" both map to references/${reference.fileName}.`,
      );
    }
    seen.set(reference.fileName, reference.skill.use);
  }
}

async function writeCandidate(options: {
  api: IntentCoreApi;
  candidate: ImportCandidate;
  cwd: string;
  destinations: ImportDestination[];
}): Promise<ImportedSkillSummary> {
  const { api, candidate, cwd, destinations } = options;
  const destinationName = safeSlugForSkill(candidate.skill.skillName);
  const references = candidate.subSkills.map((skill) => ({
    skill,
    fileName: referenceFileName(skill.skillName),
  }));
  assertUniqueReferenceFiles(references);

  const core = await readRawIntentSkill(api, cwd, candidate.skill.use);
  const loadedReferences = await Promise.all(
    references.map(async (reference) => ({
      ...reference,
      loaded: await readRawIntentSkill(api, cwd, reference.skill.use),
    })),
  );
  const skillContent = normalizeTrailingNewline(
    rewriteBundledReferenceLinks(core.content, candidate.skill, references),
  );
  const destinationSummaries: ImportedSkillDestinationSummary[] = [];

  for (const destination of destinations) {
    const destinationPath = join(cwd, destination.skillsRoot, destinationName);
    const overwritten = existsSync(destinationPath);

    await rm(destinationPath, { force: true, recursive: true });
    await mkdir(destinationPath, { recursive: true });
    await writeFile(join(destinationPath, "SKILL.md"), skillContent, "utf8");

    if (loadedReferences.length > 0) {
      const referencesPath = join(destinationPath, "references");
      await mkdir(referencesPath, { recursive: true });
      await Promise.all(
        loadedReferences.map((reference) =>
          writeFile(
            join(referencesPath, reference.fileName),
            referenceMarkdown(reference.loaded),
            "utf8",
          ),
        ),
      );
    }

    destinationSummaries.push({
      agents: destination.agents,
      agentDisplayNames: destination.displayNames,
      skillsRoot: destination.skillsRoot,
      destinationPath,
      overwritten,
    });
  }

  const primaryDestination = destinationSummaries[0];
  if (!primaryDestination) {
    throw new ImportTanStackIntentError(
      "invalid-selection",
      "Select at least one target agent to import into.",
    );
  }

  return {
    use: candidate.skill.use,
    skillName: candidate.skill.skillName,
    destinationName,
    destinationPath: primaryDestination.destinationPath,
    destinations: destinationSummaries,
    referenceCount: references.length,
    overwritten: destinationSummaries.some((destination) => destination.overwritten),
  };
}

export async function importSelectedSkills(options: {
  candidates: ImportCandidate[];
  cwd?: string;
  diagnostics?: string[];
  selectedUses: string[];
  targetAgents?: readonly AgentType[];
  api?: IntentCoreApi;
}): Promise<ImportSummary> {
  const api = options.api ?? defaultIntentCoreApi;
  const cwd = options.cwd ?? process.cwd();
  const selected = assertKnownSelections(options.selectedUses, options.candidates);
  const targetAgents = assertKnownTargetAgents(options.targetAgents ?? defaultTargetAgents);
  const destinations = resolveImportDestinations(targetAgents);
  const skills = [];

  for (const candidate of selected) {
    skills.push(await writeCandidate({ api, candidate, cwd, destinations }));
  }

  return {
    importedCount: skills.length,
    destinationCount: destinations.length,
    overwriteCount: skills.reduce(
      (count, skill) =>
        count + (skill.destinations ?? []).filter((destination) => destination.overwritten).length,
      0,
    ),
    skills,
    diagnostics: options.diagnostics ?? [],
  };
}

export async function runImport(options: {
  cwd?: string;
  selectedUses: string[];
  targetAgents?: readonly AgentType[];
  api?: IntentCoreApi;
}): Promise<ImportSummary> {
  const listed = listImportCandidates({ cwd: options.cwd, api: options.api });
  if (listed.candidates.length === 0) {
    throw createNoImportableSkillsError(listed.list);
  }
  return importSelectedSkills({
    api: options.api,
    candidates: listed.candidates,
    cwd: options.cwd,
    diagnostics: listed.diagnostics,
    selectedUses: options.selectedUses,
    targetAgents: options.targetAgents,
  });
}
