# import-tanstack-intent

Import TanStack Intent skills into the local skills directories used by your coding agents, so agents can discover and use them directly.

## Motivation

TanStack Intent’s npm-package-based approach to distributing skills is excellent: it makes skills versionable, installable, and easy to share with the same tooling developers already use for code.

The trade-off is that many agents look for skills in local skills directories instead of reading TanStack Intent package metadata directly. That makes great Intent skills harder to use in tools that expect project-local skill folders such as `.agents/skills` or `.claude/skills`.

`import-tanstack-intent` bridges that gap. It discovers TanStack Intent skills from the npm packages installed in your project and imports the ones you choose as Agent Skills, preserving bundled sub-skill references where needed.

## Usage

Run the importer from the root of a project that already has TanStack Intent skill packages installed:

```sh
npx import-tanstack-intent
```

The command will:

1. Discover importable TanStack Intent skills in the current project.
2. Show an interactive multi-select prompt for the skills to import.
3. Always enable the universal `.agents/skills` destination, then ask which additional agent-specific directories should symlink to it.
4. Write the selected skills once to `.agents/skills/<skill-name>/SKILL.md`.
5. Create symbolic links for any additional selected agents, such as `.claude/skills/<skill-name> -> .agents/skills/<skill-name>`.
6. Overwrite existing imported skill directories or links when the same destination is selected again.

Agents that natively read `.agents/skills` are enabled by default and are not shown as additional targets. Additional agents keep their normal skill paths while sharing the canonical `.agents/skills` copy through symlinks.

After importing, your selected agents can load the skills using their normal skills discovery flow.
