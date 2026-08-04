# Workspace Rules for WealthCore

## AI Testing and Review Workflow
Because the user is new to these tools, act as a senior engineering partner and take the initiative to use the installed AI tools automatically.

1. **CodeRabbit AI:** Whenever you make significant changes to the logic or architecture of this app, you MUST proactively trigger the `coderabbitai-mcp` tools (if configured) or run local code review scripts to ensure there are no bugs before presenting the work to the user.
2. **Ralph Loop:** Whenever you make UI changes or data flow changes, proactively run `npx ralph` (or relevant playwright test commands) to visually and functionally verify that the changes work in the browser. 
3. **Communication:** Do not ask the user for permission to run these verification steps. Just run them, and include the results/fixes in your final summary to the user.
