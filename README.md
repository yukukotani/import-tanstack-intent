# import-tanstack-intent

Import TanStack Intent skills into the standard Agent Skills layout (`.agents/skills`) so coding agents can discover and use them directly.

## Motivation

TanStack Intent’s npm-package-based approach to distributing skills is excellent: it makes skills versionable, installable, and easy to share with the same tooling developers already use for code.

The trade-off is that many agents look for skills in the standard Agent Skills ecosystem instead of reading TanStack Intent package metadata directly. That makes great Intent skills harder to use in tools that expect a local `.agents/skills` directory.

`import-tanstack-intent` bridges that gap. It discovers TanStack Intent skills from the npm packages installed in your project and imports the ones you choose as Agent Skills, preserving bundled sub-skill references where needed.

## Usage

Run the importer from the root of a project that already has TanStack Intent skill packages installed:

```sh
npx import-tanstack-intent
```

The command will:

1. Discover importable TanStack Intent skills in the current project.
2. Show an interactive multi-select prompt.
3. Write the selected skills to `.agents/skills/<skill-name>/SKILL.md`.
4. Overwrite existing imported skill directories when the same destination is selected again.

After importing, your agent can load the skills using its normal Agent Skills discovery flow.
