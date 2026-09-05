# pi-smart-zone

A lightweight [Pi](https://github.com/earendil-works/pi-mono) extension that keeps absolute context usage visible, changes color around the 150k-token “smart zone” boundary, and lets the agent inspect its context usage when asked.

It preserves Pi's standard footer. The extension adds only a small persistent status line:

```text
smart-zone   87k/ 150k
smart-zone  142k/ 150k  # warning color
dumb-zone   152k/ 150k  # error color
```

## Install

Published as [`pi-smart-zone`](https://www.npmjs.com/package/pi-smart-zone) on npm.

```bash
pi install npm:pi-smart-zone
```

Requires Node.js 22.19.0 or newer and Pi 0.85.1 or newer.

## Behavior

By default:

- Below 140,000 tokens: `smart-zone` in Pi's dim color
- From 140,000 through 149,999 tokens: `smart-zone` in Pi's warning color
- At 150,000 tokens and above: `dumb-zone` in Pi's error color

The thresholds are absolute token counts; they do not change with the selected model's context window. Before context usage is available, the status starts at `0`. If Pi reports usage as unknown immediately after compaction, it displays `?` until usage is available again.

The extension does not replace the footer, send notifications at thresholds, compact automatically, or add commands.

### Agent tool

The extension registers a read-only `context_usage` tool, described for use only when the user explicitly asks about current context usage, the context window, or remaining context capacity. It returns the estimated context usage and the active model's configured context window as full token counts; it does not return the smart-zone classification or thresholds.

Immediately after compaction, context usage can be temporarily unknown until the next model response. In that state, the tool succeeds with `tokens: null` in its structured details and still returns the context window. If context information is unavailable for the active model altogether, the tool returns an error.

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
