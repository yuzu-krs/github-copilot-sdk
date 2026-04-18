import { CopilotClient, approveAll, defineTool } from "@github/copilot-sdk";

// ─────────────────────────────────────────────────────────
// カスタムツール（Function Calling）とは？
//
// LLM は「文章を生成する」だけでなく、
// 「ツールを呼び出す」こともできる。
//
// 流れ:
//   ① あなたがツールを定義（名前・説明・パラメータ・処理）
//   ② LLM がプロンプトを読んで「このツールが必要だ」と判断
//   ③ SDK がツールのハンドラを実行
//   ④ 結果を LLM に返す
//   ⑤ LLM が結果を踏まえて回答を生成
//
// ポイント: いつ・何回呼ぶかは LLM が自律的に決める
// ─────────────────────────────────────────────────────────

// ① ツールを定義
const getWeather = defineTool("get_weather", {
  // description が重要: LLM はこの説明文を読んでツールを使うかどうか判断する
  description: "指定された都市の現在の天気を取得します",

  // parameters: ツールが受け取る引数の定義（JSON Schema 形式）
  parameters: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "都市名（例: Tokyo, Seattle, London）",
      },
    },
    required: ["city"],
  },

  // handler: LLM がツールを呼び出すときに実行される関数
  // 引数は parameters で定義したスキーマに従って型付けされる
  handler: async (args: { city: string }) => {
    // 実際のアプリでは天気 API（OpenWeatherMap など）を呼び出す
    // ここではダミーデータを返す
    const weatherData: Record<string, { temp: number; condition: string }> = {
      Tokyo: { temp: 22, condition: "晴れ" },
      Osaka: { temp: 24, condition: "曇り" },
      Seattle: { temp: 15, condition: "雨" },
      London: { temp: 12, condition: "霧" },
      Paris: { temp: 18, condition: "快晴" },
    };

    const data = weatherData[args.city];
    if (data) {
      return {
        city: args.city,
        temperature: `${data.temp}°C`,
        condition: data.condition,
      };
    }
    return { city: args.city, error: "データが見つかりません" };
  },
});

// ─────────────────────────────────────────────────────────

const client = new CopilotClient();

const session = await client.createSession({
  model: "gpt-4.1",
  onPermissionRequest: approveAll,
  streaming: true,
  tools: [getWeather], // ② セッションにツールを登録
});

// ストリーミング表示
session.on("assistant.message_delta", (event) => {
  process.stdout.write(event.data.deltaContent);
});

// ③ ツール実行のタイミングをログで確認
session.on("tool.execution_start", (event) => {
  console.log(`\n🔧 ツール呼び出し: ${event.data.toolName}`);
});

session.on("tool.execution_complete", (event) => {
  console.log(`✅ ツール完了: ${event.data.toolName}\n`);
});

session.on("session.idle", () => {
  console.log();
});

// ④ 東京とロンドンの天気を聞く
//    → LLM が get_weather を2回呼び出すはず
await session.sendAndWait({
  prompt: "東京とロンドンの天気を比較してください",
});

await client.stop();
process.exit(0);
