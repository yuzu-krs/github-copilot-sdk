import { CopilotClient, approveAll, defineTool } from "@github/copilot-sdk";
import * as readline from "readline";

// ─────────────────────────────────────────────────────────
// 対話型アシスタントのポイント
//
// ① セッションはステートフル（会話の文脈を保持する）
//    「前の質問で何を聞いたか」を LLM が覚えている
//
// ② readline で標準入力からユーザーの入力を受け取る
//
// ③ systemMessage でアシスタントの人格・ルールを設定できる
// ─────────────────────────────────────────────────────────

// ツール①: 現在の日時を返す
const getDate = defineTool("get_current_date", {
  description: "現在の日付と時刻を返します",
  parameters: { type: "object", properties: {} },
  handler: async () => {
    return { datetime: new Date().toLocaleString("ja-JP") };
  },
});

// ツール②: 数式を計算する
const calculate = defineTool("calculate", {
  description: "数式を計算して結果を返します（例: 1980 * 1.1）",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "計算する数式（例: 2 + 3 * 4）",
      },
    },
    required: ["expression"],
  },
  handler: async (args: { expression: string }) => {
    // 数字と演算子のみ許可（安全のため）
    const sanitized = args.expression.replace(/[^0-9+\-*/().%\s]/g, "");
    if (sanitized !== args.expression) {
      return { error: "無効な文字が含まれています" };
    }
    const result = Function(`"use strict"; return (${sanitized})`)();
    return { expression: args.expression, result };
  },
});

// ─────────────────────────────────────────────────────────

const client = new CopilotClient();

const session = await client.createSession({
  model: "gpt-4.1",
  onPermissionRequest: approveAll,
  streaming: true,
  tools: [getDate, calculate],

  // systemMessage: アシスタントの人格・ルールを設定
  // LLM はこの指示に従って回答する
  systemMessage: {
    content: `あなたは親切な日本語アシスタントです。
簡潔でわかりやすい回答を心がけてください。
数値の計算や日付の確認が必要な場合は、必ずツールを使って正確な値を返してください。`,
  },
});

// ストリーミング表示
session.on("assistant.message_delta", (event) => {
  process.stdout.write(event.data.deltaContent);
});

// readline: 標準入力からユーザーの入力を1行ずつ受け取る
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  🤖 Copilot アシスタント（対話モード）");
console.log("  利用可能なツール: 日付取得・計算");
console.log("  終了: 'exit' と入力");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// 対話ループ
const promptUser = () => {
  rl.question("あなた: ", async (input) => {
    const trimmed = input.trim();

    if (trimmed.toLowerCase() === "exit") {
      console.log("\n👋 またね！");
      await client.stop();
      rl.close();
      return;
    }

    if (!trimmed) {
      promptUser();
      return;
    }

    process.stdout.write("\nCopilot: ");
    await session.sendAndWait({ prompt: trimmed });
    console.log("\n");

    // 次の入力を待つ（再帰呼び出しでループ）
    promptUser();
  });
};

promptUser();
