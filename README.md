# voice-fix

Fix voice-dictation (ASR) transcripts in the omp composer — one keystroke, with conversation context, cancellable, and undoable.

语音输入转写的文字经常有同音错字、识别偏差。按一下快捷键，用小模型（默认 `@tiny`）结合最近的会话上下文把草稿校对成你真正想说的话。

## Features

- **One keystroke** — press the shortcut (default `F5` or `Alt+F`) or run `/vf` while a draft sits in the composer.
- **Context-aware** — recent user messages and the assistant's last reply are fed to the model, so technical terms and project vocabulary survive (`fallback` won't become "full back").
- **Apply-then-undo** — the corrected draft replaces the composer text immediately; `Ctrl+-` (editor undo) or `/vf-undo` restores the original.
- **Cancellable with live timer** — the status bar shows `Proofreading… 1.3s (Esc to cancel)`; `Esc` aborts at any point.
- **Attachment-safe** — `[Image #N]` / `[Paste #N]` markers are preserved; if the model mangles them the result is discarded and your original text is restored.
- **Configurable** — shortcut(s), model, and locale via `voice-fix.config.json`; the shortcut can also be changed in-session with `/voice-fix-key`.
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
| Proofread the draft | `F5` or `Alt+F` (default), or `/vf` |
| Show current shortcut | `/voice-fix-key` |
| Change shortcut | `/voice-fix-key <key>` — e.g. `/voice-fix-key ctrl+e` (restart required) |
| Cancel during proofreading | `Esc` |
| Undo correction | `Ctrl+-` / `Ctrl+_` (editor undo) or `/vf-undo` |

## Configuration

`voice-fix.config.json` next to `index.ts`:

```json
{
	"shortcut": ["f5", "alt+f"],
	"model": "@tiny",
	"locale": "auto",
	"language": "auto"
}
```

| Key | Default | Meaning |
|---|---|---|
| `shortcut` | `["f5", "alt+f"]` | Key id or array of key ids (`f5`, `alt+f`, `ctrl+shift+v`, …). Note: some terminals/multiplexers swallow function keys — `alt+f` is a reliable fallback. |
| `model` | `"@tiny"` | Model selector or role alias (`@tiny`, `@smol`, `provider/model-id`, optional `:effort` suffix). Auth is resolved through omp's `modelRegistry`, no extra API keys needed. |
| `locale` | `"auto"` | `"en"` / `"zh"` / `"auto"` (auto reads `LC_ALL`/`LANG`, defaults to English). |
| `language` | `"auto"` | The language the draft is dictated in, stated to the model so it keeps the output in that language. `"auto"` derives it from the UI locale — set it explicitly (e.g. `"Chinese"`, `"Japanese"`) when dictation differs from your system language. |
Editing the config file requires an omp restart; `/voice-fix-key` writes the file for you.

A `voice-fix.config.example.json` ships alongside the extension as a starting template.

## How it works

1. `F5`/`Alt+F`/`/vf` reads the composer draft.
2. Recent context (last 3 user messages + last assistant reply, text only) is inlined into the system prompt — no synthetic message objects, which avoids provider-side validation issues.
3. `streamSimple` calls the configured model with `disableReasoning: true` via an `AbortController` wired to `Esc`.
4. The result is compared against attachment markers, then written back with `setEditorText` — pending image attachments survive because `setText` never clears them. The pre-fix original is kept in memory for `/vf-undo` and in the editor's undo stack.

## Requirements

- omp ≥ 18.3 (extension API: `registerShortcut`, `registerCommand`, `ctx.ui.editor`, `ctx.models`, `ctx.modelRegistry`)
- A reachable model for the configured selector (default: the `tiny` role)

---

# voice-fix（中文）

一句话：输入框里的语音转写文字，按一个键让模型帮你校对成正确的表达。

## 特性

- **一键校对**：草稿就绪后按 `F5`/`Alt+F` 或输 `/vf`
- **上下文感知**：带上最近的对话，技术词、项目名词不会被"翻译"丢
- **先改后撤**：校对结果直接回填，改坏了 `Ctrl+-` 撤销或 `/vf-undo` 还原原文
- **可取消 + 计时**：状态栏实时显示耗时，`Esc` 随时取消
- **附件安全**：`[Image #N]` 等占位符原样保留，被改坏自动放弃结果
- **可配置**：快捷键、模型、语言都在 `voice-fix.config.json`；`/voice-fix-key` 命令可在会话内改快捷键

## 安装

在 `~/.omp/agent/config.yml` 里加：

```yaml
extensions:
  - ~/code/agent/omp-plugins/voice-fix/index.ts
```

重启 omp 生效。

## 使用

| 操作 | 方式 |
|---|---|
| 校对草稿 | `F5` / `Alt+F` 或 `/vf` |
| 查看当前快捷键 | `/voice-fix-key` |
| 改快捷键 | `/voice-fix-key <键名>`（重启生效） |
| 校对中取消 | `Esc` |
| 撤销校对 | `Ctrl+-`/`Ctrl+_` 或 `/vf-undo` |

## 配置

`voice-fix.config.json`（位于 `index.ts` 旁，可参考随包附带的 `voice-fix.config.example.json`）：

| 字段 | 默认 | 说明 |
|---|---|---|
| `shortcut` | `["f5", "alt+f"]` | 快捷键键名或键名数组 |
| `model` | `"@tiny"` | 模型选择器或角色别名 |
| `locale` | `"auto"` | `"en"` / `"zh"` / `"auto"`（自动读取 `LC_ALL`/`LANG`） |
| `language` | `"auto"` | 口述语言，会告知模型让输出保持该语言；`"auto"` 跟随系统语言，口述与系统语言不同时请显式设置（如 `"Chinese"`、`"Japanese"`） |

## License

MIT
