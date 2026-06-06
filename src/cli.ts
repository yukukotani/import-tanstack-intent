#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cli, define } from "gunshi";
import pc from "picocolors";

const CLI_NAME = "import-tanstack-intent";
const CLI_VERSION = "0.0.0";

export interface WritableLike {
  write(chunk: string): unknown;
}

export interface CliIo {
  stderr: WritableLike;
  stdout: WritableLike;
}

type ImporterModule = typeof import("./importer.ts");
type SelectionModule = typeof import("./selection.ts");

export interface CliDependencies {
  cwd?: string;
  io?: CliIo;
  loadImporter?: () => Promise<ImporterModule>;
  loadSelection?: () => Promise<SelectionModule>;
}

function defaultIo(): CliIo {
  return {
    stderr: process.stderr,
    stdout: process.stdout,
  };
}

function writeLine(stream: WritableLike, line = ""): void {
  stream.write(`${line}\n`);
}

async function defaultLoadImporter(): Promise<ImporterModule> {
  return import("./importer.js") as Promise<ImporterModule>;
}

async function defaultLoadSelection(): Promise<SelectionModule> {
  return import("./selection.js") as Promise<SelectionModule>;
}

function formatSkillCount(count: number): string {
  return `${count} skill${count === 1 ? "" : "s"}`;
}

export async function runImportCommand(dependencies: CliDependencies = {}): Promise<number> {
  const cwd = dependencies.cwd ?? process.cwd();
  const io = dependencies.io ?? defaultIo();
  const importer = await (dependencies.loadImporter ?? defaultLoadImporter)();
  const listed = importer.listImportCandidates({ cwd });

  if (listed.candidates.length === 0) {
    writeLine(io.stderr, pc.red(importer.createNoImportableSkillsError(listed.list).message));
    return 1;
  }

  const selection = await (dependencies.loadSelection ?? defaultLoadSelection)();

  for (const diagnostic of listed.diagnostics) {
    writeLine(io.stderr, pc.yellow(diagnostic));
  }

  const selected = await selection.selectImportCandidates({ candidates: listed.candidates });
  if (selected.cancelled) {
    writeLine(io.stderr, pc.yellow("Import cancelled."));
    return 0;
  }

  const summary = await importer.importSelectedSkills({
    candidates: listed.candidates,
    cwd,
    diagnostics: listed.diagnostics,
    selectedUses: selected.selectedUses,
  });

  writeLine(io.stdout, pc.green(`Imported ${formatSkillCount(summary.importedCount)}.`));
  writeLine(io.stdout, "Destination root: .agents/skills");
  writeLine(io.stdout, `Overwritten: ${summary.overwriteCount}`);
  for (const skill of summary.skills) {
    const references =
      skill.referenceCount === 1 ? "1 reference" : `${skill.referenceCount} references`;
    const status = skill.overwritten ? "overwritten" : "new";
    writeLine(
      io.stdout,
      `- ${skill.skillName} -> .agents/skills/${skill.destinationName} (${references}, ${status})`,
    );
  }

  return 0;
}

function createCommand(dependencies: CliDependencies) {
  let commandExitCode = 0;
  const command = define({
    name: CLI_NAME,
    description: "Import TanStack Intent skills into .agents/skills.",
    examples: `${CLI_NAME}\n${CLI_NAME} --help`,
    run: async () => {
      commandExitCode = await runImportCommand(dependencies);
    },
  });

  return {
    command,
    getExitCode: () => commandExitCode,
  };
}

export async function main(
  argv: string[] = process.argv.slice(2),
  dependencies: CliDependencies = {},
): Promise<number> {
  const io = dependencies.io ?? defaultIo();
  const { command, getExitCode } = createCommand(dependencies);

  try {
    await cli(argv, command, {
      name: CLI_NAME,
      version: CLI_VERSION,
    });
    return getExitCode();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeLine(io.stderr, pc.red(message));
    return 1;
  }
}

function isMainModule(): boolean {
  try {
    return (
      process.argv[1] !== undefined &&
      fileURLToPath(import.meta.url) === realpathSync(process.argv[1])
    );
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const exitCode = await main();
  process.exit(exitCode);
}
