---
name: gemini-cli
description: Run and delegate tasks using the official Google Gemini CLI (@google/gemini-cli) directly within Antigravity. Supports headless prompt execution, interactive sessions, session management, and Gemma model routing.
---

# Google Gemini CLI Skill for Antigravity

This skill enables Antigravity to execute tasks, ask questions, or run sub-agent workflows using the installed **Google Gemini CLI** (`@google/gemini-cli`).

## Executable Location
The Gemini CLI executable is located at:
`C:\Users\Admin\CreativePortfolio\npm-global\gemini.cmd`

## Core Usage Commands

### 1. Headless / Non-Interactive Prompt
To send a prompt to Gemini CLI and get text or JSON output without interactive prompts:
```powershell
& "C:\Users\Admin\CreativePortfolio\npm-global\gemini.cmd" -p "Your prompt here"
```

### 2. Output Format (JSON / Stream JSON)
To get structured JSON output from Gemini CLI:
```powershell
& "C:\Users\Admin\CreativePortfolio\npm-global\gemini.cmd" -p "Analyze this file" -o json
```

### 3. Model Selection
To specify a particular model (e.g. `gemini-2.5-pro` or `gemini-2.5-flash`):
```powershell
& "C:\Users\Admin\CreativePortfolio\npm-global\gemini.cmd" -m gemini-2.5-pro -p "Refactor function X"
```

### 4. Interactive Mode Session
To start an interactive terminal session inside Antigravity's integrated terminal:
```powershell
& "C:\Users\Admin\CreativePortfolio\npm-global\gemini.cmd"
```

### 5. Resume or List Sessions
To list past sessions:
```powershell
& "C:\Users\Admin\CreativePortfolio\npm-global\gemini.cmd" --list-sessions
```
To resume a specific session:
```powershell
& "C:\Users\Admin\CreativePortfolio\npm-global\gemini.cmd" --resume latest
```

### 6. MCP Server Management via Gemini CLI
Gemini CLI can also manage and connect to MCP servers:
```powershell
& "C:\Users\Admin\CreativePortfolio\npm-global\gemini.cmd" mcp list
```

## Best Practices
- Use `-p` (headless mode) for automated queries, file analysis, or code generation tasks inside Antigravity tasks.
- Specify `-o json` when programmatic parsing of response objects is required.
