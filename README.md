# pi-smart-zone

A lightweight [Pi](https://github.com/earendil-works/pi-mono) extension that keeps absolute context usage visible, marks the 150k-token smart-zone boundary on a compact progress bar, and lets the agent inspect its context usage when asked.

It preserves Pi's standard footer. The extension adds only a small persistent status line:

```text
✓ smart-zone  ━━━━━────│──  87k/200k
! smart-zone  ━━━━━━━━━│──  142k/200k  # warning color
✗ dumb-zone   ━━━━━━━━━│━─  180k/200k  # error color
```

## Install

Published as [`pi-smart-zone`](https://www.npmjs.com/package/pi-smart-zone) on npm.

```bash
pi install npm:pi-smart-zone
```

Requires Node.js 22.19.0 or newer and Pi 0.80.4 or newer.

## Behavior

By default:

- Below 140,000 tokens: `✓ smart-zone` in Pi's dim color
- From 140,000 through 149,999 tokens: `! smart-zone` in Pi's warning color
- At 150,000 tokens and above: `✗ dumb-zone` in Pi's error color

The thresholds are absolute token counts, while the bar spans the active model's context window. A boundary beyond that window is omitted.

When context usage is unknown, the status is unclassified. It retains a known context window when possible, or falls back to `? unknown     ?/?` when no context information is available.

The extension does not replace the footer, send notifications at thresholds, compact automatically, or add commands.

### Agent tool

The read-only `context_usage` tool returns context usage and the active model's context window as full token counts when explicitly requested. After compaction, usage may temporarily be `null` while the context window remains available.

## Configuration

Optionally create `~/.pi/agent/pi-smart-zone.json`:

```json
{
  "yellowAt": 140000,
  "redAt": 150000
}
```

Both values must be positive integers, and `yellowAt` must be less than `redAt`. If the file is absent, the defaults are used silently. If it contains invalid JSON or invalid settings, all defaults are used and Pi shows one startup warning.

Run Pi's standard `/reload` command after changing the file.

## Development

```bash
npm install
npm run check
```

To load the working copy in Pi:

```bash
pi -e ./index.ts
```

## License

[MIT](LICENSE)
