import { CopilotClient, approveAll } from "@github/copilot-sdk";

// ① クライアントを作成（Copilot CLI プロセスを自動起動）
const client = new CopilotClient();

// ② セッションを作成
const session = await client.createSession({
  model: "gpt-4.1",
  onPermissionRequest: approveAll,
});

// ③ メッセージを送信して、レスポンスが完了するまで待つ
const response = await session.sendAndWait({
  prompt: "TypeScriptの型システムの特徴を3つ教えてください",
});

// ④ レスポンスを表示
console.log(response?.data.content);

// ⑤ クリーンアップ（CLI プロセスを停止）
await client.stop();
process.exit(0);
