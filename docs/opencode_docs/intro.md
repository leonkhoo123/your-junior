# OpenCode Intro

Get started with OpenCode.

**OpenCode** is an open source AI coding agent. It's available as a terminal-based interface, desktop app, or IDE extension.

## Install

The easiest way to install OpenCode is through the install script.

```bash
curl -fsSL https://opencode.ai/install | bash
```

Other installation methods:
- **npm**: `npm install -g opencode-ai`
- **Bun**: `bun install -g opencode-ai`
- **pnpm**: `pnpm install -g opencode-ai`
- **Homebrew** (macOS/Linux): `brew install anomalyco/tap/opencode`
- **Arch Linux**: `sudo pacman -S opencode` or `paru -S opencode-bin` (AUR)
- **Windows**: Use WSL (recommended), Chocolatey, Scoop, NPM, Mise, or Docker

---

## Configure

With OpenCode you can use any LLM provider by configuring their API keys.

If you are new to using LLM providers, we recommend using **OpenCode Zen**. It's a curated list of models that have been tested and verified by the OpenCode team.

1. Run the `/connect` command in the TUI, select opencode
2. Sign in, add your billing details, and copy your API key
3. Paste your API key

Alternatively, you can select one of the other providers.

---

## Initialize

```bash
cd /path/to/project
opencode
```

Next, initialize OpenCode for the project:

```
/init
```

This will get OpenCode to analyze your project and create an `AGENTS.md` file in the project root.

> You should commit your project's `AGENTS.md` file to Git.

---

## Usage

### Ask questions

```
How is authentication handled in @packages/functions/src/api/index.ts
```

Use the `@` key to fuzzy search for files in the project.

### Add features

1. **Create a plan** — Switch to Plan mode using **Tab** key. Describe what you want: "When a user deletes a note..."
2. **Iterate on the plan** — Give feedback or add details. Drag and drop images into the terminal.
3. **Build the feature** — Switch back to Build mode (**Tab**) and say "Sounds good! Go ahead and make the changes."

### Make changes

For straightforward changes, you can ask OpenCode to directly build it:
"We need to add authentication to the /settings route..."

### Undo changes

```
/undo
```

OpenCode will revert the changes and show your original message again. Run `/undo` multiple times to undo multiple changes. Use `/redo` to redo.

---

## Share

Conversations can be shared with your team:

```
/share
```

---

## Customize

We recommend picking a theme, customizing the keybinds, configuring code formatters, creating custom commands, or playing around with the OpenCode config.
