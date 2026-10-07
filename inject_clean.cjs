const fs = require('fs');

const vars = `
:root {
  --bbg-bg: #ffffff;
  --bbg-surface: #f8fafc;
  --bbg-border: #e2e8f0;
  --bbg-text-main: #0f172a;
  --bbg-text-muted: #64748b;
  --bbg-green: #16a34a;
  --bbg-red: #dc2626;
  --bbg-accent: #2563eb;
  --bbg-header-bg: #fcfcfd;
  --bbg-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  --bbg-active-bg: #eff6ff;
  --bbg-hover-bg: #f1f5f9;
}

[data-theme='dark'] {
  --bbg-bg: #000000;
  --bbg-surface: #0a0a0a;
  --bbg-border: #262626;
  --bbg-text-main: #f3f4f6;
  --bbg-text-muted: #9ca3af;
  --bbg-green: #4ade80;
  --bbg-red: #f87171;
  --bbg-accent: #f59e0b;
  --bbg-header-bg: #171717;
  --bbg-active-bg: #262626;
  --bbg-hover-bg: #1f1f1f;
}
`;

let css = fs.readFileSync('src/index.css', 'utf8');
const lines = css.split('\n');
lines.splice(1, 0, vars);
fs.writeFileSync('src/index.css', lines.join('\n'));
