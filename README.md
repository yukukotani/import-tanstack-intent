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
2. Ask which target agents should receive the imported skills.
3. Show an interactive multi-select prompt for the skills to import.
4. Write the selected skills to each chosen agent’s configured project-local skills directory, such as `.agents/skills/<skill-name>/SKILL.md` or `.claude/skills/<skill-name>/SKILL.md`.
5. Overwrite existing imported skill directories when the same destination is selected again.

Multiple selected agents may share the same skills directory. In that case, the importer writes that directory once and reports the shared destination with all matching agent names.

After importing, your selected agents can load the skills using their normal skills discovery flow.
