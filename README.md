# voice-fix

English | [简体中文](README.zh-CN.md)

Fix voice-dictation (ASR) transcripts in the omp composer — one keystroke, with conversation context, cancellable, and undoable.

## Features

- **One keystroke** — press the shortcut (default `Alt+Z`) or run `/vf` while a draft sits in the composer.
- **Context-aware** — recent user messages and the assistant's last reply are fed to the model, so technical terms and project vocabulary survive (`fallback` won't become "full back").
- **Apply-then-undo** — the corrected draft replaces the composer text immediately; `Ctrl+-` (editor undo) or `/vf-undo` restores the original.
- **Cancellable with live timer** — the status bar shows `Proofreading… 1.3s (Esc to cancel)`; `Esc` aborts at any point.
- **Attachment-safe** — `[Image #N]` / `[Paste #N]` markers are preserved; if the model mangles them the result is discarded and your original text is restored.
- **Configurable** — shortcut(s), model, UI language, and dictation language via `voice-fix.config.json`; the shortcut can also be changed in-session with `/voice-fix-key`.
- **i18n** — UI strings in English and Chinese, following `LC_ALL`/`LANG` or the `locale` config.

## Install

Point omp at the extension file (or the package directory, resolved via `package.json#omp.extensions`):

```yaml
# ~/.omp/agent/config.yml
extensions:
  - ~/code/agent/omp-plugins/voice-fix/index.ts
```

Or per-invocation:

```bash
omp --extension ~/code/agent/omp-plugins/voice-fix/index.ts
```

Restart omp after adding it.

## Usage

| Action | How |
|---|---|
| Proofread the draft | `Alt+Z` (default) or `/vf` |
| Show current shortcut | `/voice-fix-key` |
| Change shortcut | `/voice-fix-key <key>` — e.g. `/voice-fix-key ctrl+e` (restart required) |
| Cancel during proofreading | `Esc` |
| Undo correction | `Ctrl+-` / `Ctrl+_` (editor undo) or `/vf-undo` |

## Configuration

`voice-fix.config.json` next to `index.ts`:

```json
{
	"shortcut": ["alt+z"],
	"model": "@tiny",
	"locale": "auto",
	"language": "auto"
}
```

| Key | Default | Meaning |
|---|---|---|
| `shortcut` | `["alt+z"]` | Key id or array of key ids (`alt+z`, `f6`, `ctrl+shift+v`, …). On macOS, `Alt` shortcuts need the terminal's "Option as Meta" setting. |
| `model` | `"@tiny"` | Model selector or role alias (`@tiny`, `@smol`, `provider/model-id`, optional `:effort` suffix). Auth is resolved through omp's `modelRegistry`, no extra API keys needed. |
| `locale` | `"auto"` | `"en"` / `"zh"` / `"auto"` (auto reads `LC_ALL`/`LANG`, defaults to English). |
| `language` | `"auto"` | The language the draft is dictated in, stated to the model so it keeps the output in that language. `"auto"` derives it from the UI locale — set it explicitly (e.g. `"Chinese"`, `"Japanese"`) when dictation differs from your system language. |

Editing the config file requires an omp restart; `/voice-fix-key` writes the file for you.

A `voice-fix.config.example.json` ships alongside the extension as a starting template.

## How it works

1. `Alt+Z`/`/vf` reads the composer draft.
2. Recent context (last 3 user messages + last assistant reply, text only) is inlined into the system prompt — no synthetic message objects, which avoids provider-side validation issues.
3. `streamSimple` calls the configured model with `disableReasoning: true` via an `AbortController` wired to `Esc`.
4. The result is compared against attachment markers, then written back with `setEditorText` — pending image attachments survive because `setText` never clears them. The pre-fix original is kept in memory for `/vf-undo` and in the editor's undo stack.

## Requirements

- omp ≥ 18.3 (extension API: `registerShortcut`, `registerCommand`, `ctx.ui.editor`, `ctx.models`, `ctx.modelRegistry`)
- A reachable model for the configured selector (default: the `tiny` role)

## License

MIT
