export interface AgentConfig {
  displayName: string;
  skillsDir: string;
}

export const agents = {
  "aider-desk": { displayName: "AiderDesk", skillsDir: ".aider-desk/skills" },
  amp: { displayName: "Amp", skillsDir: ".agents/skills" },
  antigravity: { displayName: "Antigravity", skillsDir: ".agents/skills" },
  "antigravity-cli": { displayName: "Antigravity CLI", skillsDir: ".agents/skills" },
  astrbot: { displayName: "AstrBot", skillsDir: "data/skills" },
  "autohand-code": { displayName: "Autohand Code CLI", skillsDir: ".autohand/skills" },
  augment: { displayName: "Augment", skillsDir: ".augment/skills" },
  bob: { displayName: "IBM Bob", skillsDir: ".bob/skills" },
  "claude-code": { displayName: "Claude Code", skillsDir: ".claude/skills" },
  openclaw: { displayName: "OpenClaw", skillsDir: "skills" },
  cline: { displayName: "Cline", skillsDir: ".agents/skills" },
  "codearts-agent": { displayName: "CodeArts Agent", skillsDir: ".codeartsdoer/skills" },
  codebuddy: { displayName: "CodeBuddy", skillsDir: ".codebuddy/skills" },
  codemaker: { displayName: "Codemaker", skillsDir: ".codemaker/skills" },
  codestudio: { displayName: "Code Studio", skillsDir: ".codestudio/skills" },
  codex: { displayName: "Codex", skillsDir: ".agents/skills" },
  "command-code": { displayName: "Command Code", skillsDir: ".commandcode/skills" },
  continue: { displayName: "Continue", skillsDir: ".continue/skills" },
  cortex: { displayName: "Cortex Code", skillsDir: ".cortex/skills" },
  crush: { displayName: "Crush", skillsDir: ".crush/skills" },
  cursor: { displayName: "Cursor", skillsDir: ".agents/skills" },
  deepagents: { displayName: "Deep Agents", skillsDir: ".agents/skills" },
  devin: { displayName: "Devin for Terminal", skillsDir: ".devin/skills" },
  dexto: { displayName: "Dexto", skillsDir: ".agents/skills" },
  droid: { displayName: "Droid", skillsDir: ".factory/skills" },
  firebender: { displayName: "Firebender", skillsDir: ".agents/skills" },
  forgecode: { displayName: "ForgeCode", skillsDir: ".forge/skills" },
  "gemini-cli": { displayName: "Gemini CLI", skillsDir: ".agents/skills" },
  "github-copilot": { displayName: "GitHub Copilot", skillsDir: ".agents/skills" },
  goose: { displayName: "Goose", skillsDir: ".goose/skills" },
  "hermes-agent": { displayName: "Hermes Agent", skillsDir: ".hermes/skills" },
  "inference-sh": { displayName: "inference.sh", skillsDir: ".inferencesh/skills" },
  jazz: { displayName: "Jazz", skillsDir: ".jazz/skills" },
  junie: { displayName: "Junie", skillsDir: ".junie/skills" },
  "iflow-cli": { displayName: "iFlow CLI", skillsDir: ".iflow/skills" },
  kilo: { displayName: "Kilo Code", skillsDir: ".kilocode/skills" },
  "kimi-code-cli": { displayName: "Kimi Code CLI", skillsDir: ".agents/skills" },
  "kiro-cli": { displayName: "Kiro CLI", skillsDir: ".kiro/skills" },
  kode: { displayName: "Kode", skillsDir: ".kode/skills" },
  lingma: { displayName: "Lingma", skillsDir: ".lingma/skills" },
  loaf: { displayName: "Loaf", skillsDir: ".agents/skills" },
  mcpjam: { displayName: "MCPJam", skillsDir: ".mcpjam/skills" },
  "mistral-vibe": { displayName: "Mistral Vibe", skillsDir: ".vibe/skills" },
  moxby: { displayName: "Moxby", skillsDir: ".moxby/skills" },
  mux: { displayName: "Mux", skillsDir: ".mux/skills" },
  neovate: { displayName: "Neovate", skillsDir: ".neovate/skills" },
  opencode: { displayName: "OpenCode", skillsDir: ".agents/skills" },
  openhands: { displayName: "OpenHands", skillsDir: ".openhands/skills" },
  ona: { displayName: "Ona", skillsDir: ".ona/skills" },
  pi: { displayName: "Pi", skillsDir: ".pi/skills" },
  qoder: { displayName: "Qoder", skillsDir: ".qoder/skills" },
  "qoder-cn": { displayName: "Qoder CN", skillsDir: ".qoder/skills" },
  "qwen-code": { displayName: "Qwen Code", skillsDir: ".qwen/skills" },
  replit: { displayName: "Replit", skillsDir: ".agents/skills" },
  reasonix: { displayName: "Reasonix", skillsDir: ".reasonix/skills" },
  roo: { displayName: "Roo Code", skillsDir: ".roo/skills" },
  rovodev: { displayName: "Rovo Dev", skillsDir: ".rovodev/skills" },
  "tabnine-cli": { displayName: "Tabnine CLI", skillsDir: ".tabnine/agent/skills" },
  terramind: { displayName: "Terramind", skillsDir: ".terramind/skills" },
  tinycloud: { displayName: "Tinycloud", skillsDir: ".tinycloud/skills" },
  trae: { displayName: "Trae", skillsDir: ".trae/skills" },
  "trae-cn": { displayName: "Trae CN", skillsDir: ".trae/skills" },
  warp: { displayName: "Warp", skillsDir: ".agents/skills" },
  windsurf: { displayName: "Windsurf", skillsDir: ".windsurf/skills" },
  zed: { displayName: "Zed", skillsDir: ".agents/skills" },
  zencoder: { displayName: "Zencoder", skillsDir: ".zencoder/skills" },
  zenflow: { displayName: "Zenflow", skillsDir: ".zencoder/skills" },
  pochi: { displayName: "Pochi", skillsDir: ".pochi/skills" },
  promptscript: { displayName: "PromptScript", skillsDir: ".agents/skills" },
  adal: { displayName: "AdaL", skillsDir: ".adal/skills" },
  universal: { displayName: "Universal", skillsDir: ".agents/skills" },
} as const satisfies Record<string, AgentConfig>;

export type AgentType = keyof typeof agents;

export interface ImportDestination {
  agents: AgentType[];
  displayNames: string[];
  skillsRoot: string;
}

export const defaultTargetAgents = ["universal"] as const satisfies readonly AgentType[];

export function isAgentType(value: string): value is AgentType {
  return Object.hasOwn(agents, value);
}

export function resolveImportDestinations(
  targetAgents: readonly AgentType[] = defaultTargetAgents,
): ImportDestination[] {
  const bySkillsRoot = new Map<string, ImportDestination>();

  for (const agent of targetAgents) {
    const config = agents[agent];
    const existing = bySkillsRoot.get(config.skillsDir);
    if (existing) {
      existing.agents.push(agent);
      existing.displayNames.push(config.displayName);
      continue;
    }

    bySkillsRoot.set(config.skillsDir, {
      agents: [agent],
      displayNames: [config.displayName],
      skillsRoot: config.skillsDir,
    });
  }

  return [...bySkillsRoot.values()];
}
