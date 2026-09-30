# voice-fix

[English](README.md) | 简体中文

语音输入转写的文字经常有同音错字、识别偏差。按一下快捷键，用小模型（默认 `@tiny`）结合最近的会话上下文把草稿校对成你真正想说的话。

## 特性

- **一键校对**：草稿就绪后按 `Alt+Z` 或输 `/vf`
- **上下文感知**：带上最近的对话，技术词、项目名词不会被“翻译”丢
- **先改后撤**：校对结果直接回填，改坏了 `Ctrl+-` 撤销或 `/vf-undo` 还原原文
- **可取消 + 计时**：状态栏实时显示耗时，`Esc` 随时取消
- **附件安全**：`[Image #N]` 等占位符原样保留，被改坏自动放弃结果
- **可配置**：快捷键、模型、界面语言和口述语言都在 `voice-fix.config.json`；`/voice-fix-key` 命令可在会话内改快捷键

## 安装

在 `~/.omp/agent/config.yml` 里加：

```yaml
extensions:
  - ~/code/agent/omp-plugins/voice-fix/index.ts
```

或者单次运行时指定：

```bash
omp --extension ~/code/agent/omp-plugins/voice-fix/index.ts
```

添加后重启 omp。

## 使用

| 操作 | 方式 |
|---|---|
| 校对草稿 | `Alt+Z` 或 `/vf` |
| 查看当前快捷键 | `/voice-fix-key` |
| 改快捷键 | `/voice-fix-key <键名>`（重启生效） |
| 校对中取消 | `Esc` |
| 撤销校对 | `Ctrl+-`/`Ctrl+_` 或 `/vf-undo` |

## 配置

`voice-fix.config.json`（位于 `index.ts` 旁，可参考随包附带的 `voice-fix.config.example.json`）：

```json
{
	"shortcut": ["alt+z"],
	"model": "@tiny",
	"locale": "auto",
	"language": "auto"
}
```

| 字段 | 默认 | 说明 |
|---|---|---|
| `shortcut` | `["alt+z"]` | 快捷键键名或键名数组；macOS 上 `Alt` 组合键需在终端开启“Option 作为 Meta 键” |
| `model` | `"@tiny"` | 模型选择器或角色别名 |
| `locale` | `"auto"` | `"en"` / `"zh"` / `"auto"`（自动读取 `LC_ALL`/`LANG`） |
| `language` | `"auto"` | 口述语言，会告知模型让输出保持该语言；`"auto"` 跟随系统语言，口述与系统语言不同时请显式设置（如 `"Chinese"`、`"Japanese"`） |

修改配置文件后需要重启 omp；`/voice-fix-key` 会替你写入快捷键配置。

## 工作原理

1. `Alt+Z`/`/vf` 读取输入框草稿。
2. 将最近 3 条用户消息和助手最后一条回复中的纯文本放入 system prompt，作为上下文参考；不构造虚假的消息对象，避免触发 provider 校验问题。
3. `streamSimple` 使用配置的模型，并通过与 `Esc` 连接的 `AbortController` 支持取消。
4. 比对附件标记后，用 `setEditorText` 写回结果；待发送的图片附件会保留，因为 `setText` 不会清除它们。校对前的原文会保存在内存和编辑器 undo 栈中，供 `/vf-undo` 或编辑器撤销使用。

## 要求

- omp ≥ 18.3（扩展 API：`registerShortcut`、`registerCommand`、`ctx.ui.editor`、`ctx.models`、`ctx.modelRegistry`）
- 配置的模型选择器对应一个可访问的模型（默认使用 `tiny` 角色）

## License

MIT
