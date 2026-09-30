// @ts-nocheck
// voice-fix: fix ASR/voice-dictation drafts in the composer with a small model.
// Config: ./voice-fix.config.json (or /voice-fix-key <key> in-session; restart required).
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { streamSimple } from "@oh-my-pi/pi-ai";

const CONFIG_URL = new URL("./voice-fix.config.json", import.meta.url);
const STATUS_KEY = "voice-fix";
// Context: recent user messages + the last assistant reply (plain text only).
const CONTEXT_USER_TURNS = 3;
// Attachment placeholders that must survive correction verbatim.
const ATTACHMENT_TOKEN = /\[Image #\d+[^\]]*\]|\[Paste #\d+[^\]]*\]/g;

const STRINGS = {
	"zh": {
		shortcutDesc: "用模型校对语音识别草稿",
		keyCmdDesc: "改 voice-fix 快捷键，用法: /voice-fix-key <键名>，如 f5、ctrl+shift+v、alt+x",
		vfDesc: "校对当前草稿（等同快捷键）",
		currentKeys: keys => `当前快捷键: ${keys}（改后需重启 omp 生效）`,
		invalidKey: key => `无效键名: ${key}`,
		writeFailed: msg => `写配置失败: ${msg}`,
		keyUpdated: key => `voice-fix 快捷键已改为 ${key}，重启 omp 生效`,
		emptyDraft: "输入框为空",
		badModel: model => `voice-fix: 无法解析模型 ${model}`,
		working: elapsed => `校对语音转写中… ${elapsed}（Esc 取消）`,
		cancelled: elapsed => `voice-fix: 已取消（${elapsed}），保留原文`,
		failed: (elapsed, msg) => `voice-fix 失败（${elapsed}）: ${msg}`,
		attachmentsBroken: elapsed => `voice-fix: 附件标记被改动（${elapsed}），已放弃校对结果`,
		unchanged: elapsed => `voice-fix: 无需修改（${elapsed}）`,
		applied: elapsed => `voice-fix: 已回填（校对耗时 ${elapsed}）`,
		restored: "voice-fix: 已还原原文",
		nothingToUndo: "voice-fix: 没有可还原的草稿",
		vfUndoDesc: "还原 voice-fix 替换前的草稿",
		escRestore: "Esc 还原原文",
		dictationHint: lang => `- 口述语言为 ${lang}，输出语言不变。`,
		systemPrompt: [
			"你是语音输入的校对器。输入是语音识别（ASR）的转写结果，常含同音错字、漏字、错分段和口语冗余。",
			"任务：结合最近的对话上下文，还原用户真正想表达的文字。",
			"规则：",
			"- 只修正识别错误和明显语病，保留原文的语言、原意和口吻；",
			"- 技术词汇、英文名词、模型名、命令行、文件路径优先按上下文还原，不要翻译；",
			"- 文中形如 [Image #N]、[Paste #N] 的方括号标记是附件占位符，必须原样保留，不得修改、删除或挪动语义位置；",
			"- 拿不准的地方保留原样，不要发挥、不要扩写、不要解释；",
			"- 输出仅包含修正后的文本本身，不加引号、不加前后缀、不加注释。",
		].join("\n"),
	userContextHeader: "用户最近说的话（上下文参考，不要复述）：",
	assistantContextHeader: "助手最近一条回复（上下文参考，不要复述）：",
	},
	"zh-hant": {
		shortcutDesc: "用模型校對語音辨識草稿",
		keyCmdDesc: "改 voice-fix 快捷鍵，用法: /voice-fix-key <鍵名>，如 f5、ctrl+shift+v、alt+x",
		vfDesc: "校對目前草稿（等同快捷鍵）",
		currentKeys: keys => `目前快捷鍵: ${keys}（改後需重啟 omp 生效）`,
		invalidKey: key => `無效鍵名: ${key}`,
		writeFailed: msg => `寫入設定失敗: ${msg}`,
		keyUpdated: key => `voice-fix 快捷鍵已改為 ${key}，重啟 omp 生效`,
		emptyDraft: "輸入框為空",
		badModel: model => `voice-fix: 無法解析模型 ${model}`,
		working: elapsed => `校對語音轉寫中… ${elapsed}（Esc 取消）`,
		cancelled: elapsed => `voice-fix: 已取消（${elapsed}），保留原文`,
		failed: (elapsed, msg) => `voice-fix 失敗（${elapsed}）: ${msg}`,
		attachmentsBroken: elapsed => `voice-fix: 附件標記被改動（${elapsed}），已放棄校對結果`,
		unchanged: elapsed => `voice-fix: 無需修改（${elapsed}）`,
		applied: elapsed => `voice-fix: 已回填（校對耗時 ${elapsed}）`,
		restored: "voice-fix: 已還原原文",
		nothingToUndo: "voice-fix: 沒有可還原的草稿",
		vfUndoDesc: "還原 voice-fix 替換前的草稿",
		escRestore: "Esc 還原原文",
		dictationHint: lang => `- 口述語言為 ${lang}，輸出語言不變。`,
		systemPrompt: [
			"你是語音輸入的校對器。輸入是語音辨識（ASR）的轉寫結果，常含同音錯字、漏字、錯分段和口語冗贅。",
			"任務：結合最近的對話脈絡，還原使用者真正想表達的文字。",
			"規則：",
			"- 只修正辨識錯誤和明顯語病，保留原文的語言、原意和口吻；",
			"- 技術詞彙、英文名詞、模型名、命令列、檔案路徑優先按脈絡還原，不要翻譯；",
			"- 文中形如 [Image #N]、[Paste #N] 的方括號標記是附件佔位符，必須原樣保留，不得修改、刪除或挪動語義位置；",
			"- 拿不準的地方保留原樣，不要發揮、不要擴寫、不要解釋；",
			"- 輸出僅包含修正後的文字本身，不加引號、不加前後綴、不加註釋。",
		].join("\n"),
		userContextHeader: "使用者最近說的話（脈絡參考，不要複述）：",
		assistantContextHeader: "助手最近一條回覆（脈絡參考，不要複述）：",
	},
	en: {
		shortcutDesc: "Proofread the voice-dictation draft with a small model",
		keyCmdDesc: "Change the voice-fix shortcut: /voice-fix-key <key>, e.g. f5, ctrl+shift+v, alt+x",
		vfDesc: "Proofread the current draft (same as the shortcut)",
		currentKeys: keys => `Current shortcut: ${keys} (takes effect after restarting omp)`,
		invalidKey: key => `Invalid key name: ${key}`,
		writeFailed: msg => `Failed to write config: ${msg}`,
		keyUpdated: key => `voice-fix shortcut changed to ${key}; restart omp to apply`,
		emptyDraft: "Composer is empty",
		badModel: model => `voice-fix: cannot resolve model ${model}`,
		working: elapsed => `Proofreading dictation… ${elapsed} (Esc to cancel)`,
		cancelled: elapsed => `voice-fix: cancelled (${elapsed}); original kept`,
		failed: (elapsed, msg) => `voice-fix failed (${elapsed}): ${msg}`,
		attachmentsBroken: elapsed => `voice-fix: attachment markers altered (${elapsed}); discarded result`,
		unchanged: elapsed => `voice-fix: nothing to fix (${elapsed})`,
		applied: elapsed => `voice-fix: applied (took ${elapsed})`,
		restored: "voice-fix: original draft restored",
		nothingToUndo: "voice-fix: nothing to restore",
		vfUndoDesc: "Restore the draft as it was before voice-fix",
		escRestore: "Esc to restore the original",
		dictationHint: lang => `- The dictation language is ${lang}; keep the output in ${lang}.`,
		systemPrompt: [
			"You are a proofreader for voice dictation. The input is speech-to-text output that may contain misheard words, missing characters, bad segmentation, and filler.",
			"Task: reconstruct what the user actually meant, using the recent conversation as context.",
			"Rules:",
			"- Only fix recognition errors and clear grammar slips; keep the original language, meaning, and tone;",
			"- Technical terms, proper nouns, model names, commands, and file paths should be reconstructed from context, never translated;",
			"- Bracketed markers like [Image #N] or [Paste #N] are attachment placeholders — preserve them verbatim; never modify, delete, or move them;",
			"- When unsure, keep the original text; do not embellish, expand, or explain;",
			"- Output only the corrected text itself — no quotes, no prefix, no commentary.",
		].join("\n"),
		userContextHeader: "Recent user messages (context only, do not repeat):",
		assistantContextHeader: "The assistant's latest reply (context only, do not repeat):",
	},
};

let config = { shortcut: ["f5", "alt+f"], model: "@tiny", locale: "auto", language: "auto" };
try {
	config = { ...config, ...JSON.parse(readFileSync(CONFIG_URL, "utf8")) };
} catch {
	// Missing or malformed config file falls back to defaults.
}

function detectLocale() {
	if (config.locale !== "auto") return config.locale;
	const env = (process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || "").toLowerCase();
	if (env && env !== "c" && env !== "c.utf-8" && env !== "posix") {
		return env;
	}
	// 终端 env 常为 C.UTF-8；macOS 上真实语言偏好存在 AppleLocale
	if (process.platform === "darwin") {
		try {
			return execFileSync("defaults", ["read", "-g", "AppleLocale"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
				.trim()
				.toLowerCase();
		} catch {
			return "";
		}
	}
	return "";
}

function resolveStrings(localeTag) {
	const tag = localeTag.toLowerCase().replace(/_/g, "-");
	if (tag.startsWith("zh")) {
		if (/hant|tw|hk|mo/.test(tag)) return STRINGS["zh-hant"];
		return STRINGS.zh;
	}
	return STRINGS.en;
}

// Language the user dictates in; "auto" follows the system locale (or `locale` config).
// Free-form values (e.g. "Japanese", "粤语") also work — the string is inlined into the prompt.
function resolveDictationLanguage() {
	if (config.language !== "auto") return config.language;
	const tag = detectLocale().replace(/_/g, "-").replace(/[.@+].*$/, "");
	if (!tag) return "";
	if (tag.startsWith("zh")) {
		return /hant|tw|hk|mo/.test(tag) ? "Traditional Chinese" : "Chinese";
	}
	try {
		const name = new Intl.DisplayNames(["en"], { type: "language" }).of(tag.split("-")[0]);
		return typeof name === "string" && name !== tag.split("-")[0] ? name : "";
	} catch {
		return "";
	}
}

const t = resolveStrings(detectLocale());
const dictationLanguage = resolveDictationLanguage();

export default function (pi) {
	let lastOriginal; // 最近一次被替换的草稿原文，供 /vf-undo 恢复

	const keyList = () => (Array.isArray(config.shortcut) ? config.shortcut.join(", ") : config.shortcut);

	pi.registerCommand("voice-fix-key", {
		description: `${t.keyCmdDesc}（当前: ${keyList()}）`,
		handler: async (args, ctx) => {
			const key = (args ?? "").trim().toLowerCase();
			if (!key) {
				ctx.ui.notify(t.currentKeys(keyList()), "info");
				return;
			}
			if (!/^[a-z0-9]+([+][a-z0-9]+)*$/.test(key)) {
				ctx.ui.notify(t.invalidKey(key), "error");
				return;
			}
			try {
				writeFileSync(CONFIG_URL, JSON.stringify({ ...config, shortcut: key }, null, "\t") + "\n");
			} catch (error) {
				ctx.ui.notify(t.writeFailed(error instanceof Error ? error.message : String(error)), "error");
				return;
			}
			config.shortcut = key;
			ctx.ui.notify(t.keyUpdated(key), "info");
		},
	});

	async function fixDraft(ctx) {
		const original = ctx.ui.getEditorText();
		if (!original.trim()) {
			ctx.ui.notify(t.emptyDraft, "info");
			return;
		}

		const model = ctx.models.resolve(config.model);
		if (!model) {
			ctx.ui.notify(t.badModel(config.model), "error");
			return;
		}

		// All context goes through the system prompt as plain text — never fabricate
		// message objects, provider internals assume canonical message shapes.
		const userTexts = [];
		let lastAssistantText = "";
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "message") continue;
			const role = entry.message?.role;
			const text = (entry.message?.content ?? [])
				.filter(block => block.type === "text")
				.map(block => block.text)
				.join("")
				.trim();
			if (!text) continue;
			if (role === "user") userTexts.push(text);
			else if (role === "assistant") lastAssistantText = text;
		}
		let contextBlock = "";
		const recentUser = userTexts.slice(-CONTEXT_USER_TURNS);
		if (recentUser.length > 0) {
			contextBlock += `\n\n${t.userContextHeader}\n` + recentUser.map(text => `- ${text.slice(0, 300)}`).join("\n");
		}
		if (lastAssistantText) {
			contextBlock += `\n\n${t.assistantContextHeader}\n${lastAssistantText.slice(-1500)}`;
		}
		const systemPrompt = t.systemPrompt + (dictationLanguage ? `\n${t.dictationHint(dictationLanguage)}` : "") + contextBlock;
		const messages = [{ role: "user", content: original, timestamp: Date.now() }];

		const abort = new AbortController();
		ctx.ui.setEditorText("");
		const stopInput = ctx.ui.onTerminalInput(data => {
			// Bare Esc, Esc glued to a prefix, or any escape sequence all cancel;
			// consume:true swallows the input so nothing else handles it.
			if (data.startsWith("\x1b")) {
				abort.abort();
				return { consume: true };
			}
			return undefined;
		});
		const startTime = Date.now();
		const elapsed = () => `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
		ctx.ui.setStatus(STATUS_KEY, t.working("0.0s"));
		const timer = ctx.setInterval(() => {
			ctx.ui.setStatus(STATUS_KEY, t.working(elapsed()));
		}, 100);

		let corrected;
		try {
			const stream = streamSimple(
				model,
				{ systemPrompt: [systemPrompt], messages },
				{
					apiKey: ctx.modelRegistry.resolver(model),
					disableReasoning: true,
					signal: abort.signal,
				},
			);
			let text = "";
			for await (const event of stream) {
				if (event.type === "text_delta") text += event.delta;
				if (event.type === "error") {
					throw new Error(event.error?.errorMessage ?? "stream error");
				}
			}
			corrected = text
				.trim()
				.replace(/^["'「『]+|["'」』]+$/g, "");
			if (abort.signal.aborted) {
				ctx.ui.setEditorText(original);
				ctx.ui.notify(t.cancelled(elapsed()), "info");
				return;
			}
		} catch (error) {
			ctx.ui.setEditorText(original);
			ctx.ui.notify(
				abort.signal.aborted
					? t.cancelled(elapsed())
					: t.failed(elapsed(), error instanceof Error ? error.message : String(error)),
				abort.signal.aborted ? "info" : "error",
			);
			return;
		} finally {
			stopInput();
			ctx.clearTimer(timer);
			ctx.ui.setStatus(STATUS_KEY, undefined);
		}

		// 只统计模型校对耗时；用户在确认框里编辑的时间不计入
		const fixTime = elapsed();

		// Safety net: if the model dropped or mangled attachment markers, discard the result.
		const originalTokens = original.match(ATTACHMENT_TOKEN) ?? [];
		const correctedTokens = corrected.match(ATTACHMENT_TOKEN) ?? [];
		if (originalTokens.join() !== correctedTokens.join()) {
			ctx.ui.setEditorText(original);
			ctx.ui.notify(t.attachmentsBroken(fixTime), "warning");
			return;
		}

		if (!corrected || corrected === original) {
			ctx.ui.setEditorText(original);
			ctx.ui.notify(t.unchanged(fixTime), "info");
			return;
		}

		// 直接回填校对结果。撤销方式：回填后再按一次 Esc、编辑器 undo（Ctrl+-）、或 /vf-undo。
		lastOriginal = original;
		const stopUndoListener = ctx.ui.onTerminalInput(data => {
			if (lastOriginal === undefined) return;
			// 原文待还原期间：Esc 还原并吞掉这次按键，避免主编辑器清空草稿
			if (data === "\x1b") {
				ctx.ui.setEditorText(lastOriginal);
				lastOriginal = undefined;
				stopUndoListener();
				ctx.ui.notify(t.restored, "info");
				return { consume: true };
			}
			// 任何其他输入（继续打字、提交、双击 Esc 等）视为接受了校对结果，撤销窗口关闭
			lastOriginal = undefined;
			stopUndoListener();
			return undefined;
		});
		ctx.ui.setEditorText(corrected);
		ctx.ui.notify(`${t.applied(fixTime)} — ${t.escRestore}`, "info");
	}

	pi.registerCommand("vf", {
		description: t.vfDesc,
		handler: async (_args, ctx) => fixDraft(ctx),
	});

	pi.registerCommand("vf-undo", {
		description: t.vfUndoDesc,
		handler: async (_args, ctx) => {
			if (lastOriginal === undefined) {
				ctx.ui.notify(t.nothingToUndo, "info");
				return;
			}
			ctx.ui.setEditorText(lastOriginal);
			lastOriginal = undefined;
			ctx.ui.notify(t.restored, "info");
		},
	});

	for (const key of Array.isArray(config.shortcut) ? config.shortcut : [config.shortcut]) {
		pi.registerShortcut(key, {
			description: t.shortcutDesc,
			handler: async ctx => fixDraft(ctx),
		});
	}
}
