
import { GoogleGenAI, Type } from "@google/genai";
import { NovelConfig, Chapter } from "./types";

// Using the recommended model for complex creative writing
const MODEL_NAME = "gemini-3-pro-preview";

// Helper to initialize AI
const getAI = (apiKey: string) => new GoogleGenAI({ apiKey });

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Utility to clean markdown code blocks from JSON string
 * Gemini often returns ```json ... ``` which breaks JSON.parse
 */
const cleanJson = (text: string): string => {
  if (!text) return "{}";
  let cleaned = text.trim();
  // Remove markdown code blocks (handles start and end including potential newlines)
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/, "");
  cleaned = cleaned.replace(/\s*```$/, "");
  return cleaned.trim();
};

/**
 * Generic retry wrapper for AI calls.
 * Retries up to 3 times with exponential backoff.
 */
async function callAIWithRetry<T>(
  operation: () => Promise<T>, 
  retries = 3, 
  baseDelay = 2000
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries > 0 && (error.status === 503 || error.status === 500 || error.message?.includes("overloaded"))) {
      console.warn(`AI Call failed, retrying... (${retries} attempts left). Error: ${error.message}`);
      await delay(baseDelay);
      return callAIWithRetry(operation, retries - 1, baseDelay * 2);
    }
    throw error;
  }
}

const SYSTEM_INSTRUCTION = `
你是一位世界顶级的小说家（白金大神级）。
你熟悉“番茄小说”、“起点中文网”的爆款爽文节奏。
你的核心要求是：
1. **沉浸感**：拒绝大纲式、总结式的写作。通过动作、神态、对话、环境描写来展示剧情（Show, don't tell）。
2. **拒绝AI味**：禁止使用“随着时间的推移”、“综上所述”、“值得一提的是”、“心中五味杂陈”等教科书式连接词。
3. **逻辑与智商**：反派智商在线，主角杀伐果断，布局草蛇灰线。
4. **节奏**：三千字一小高潮，一万字一大高潮。
始终保持中文输出。
`;

// NEW: Recommend settings based on trends
export const generateTrendConfig = async (apiKey: string): Promise<NovelConfig> => {
  const ai = getAI(apiKey);
  const prompt = `
  请扮演一位资深网文编辑。检索你知识库中关于“番茄小说”、“起点”等平台的爆款热门趋势。
  随机构思一部具有“爆款潜质”的小说设定。
  
  类型参考（随机选一）：高智商犯罪、赛博修仙、末日囤货、反派重生、规则怪谈、历史权谋。
  
  【要求】
  1. 标题：要足够吸睛，符合新媒体风（例如：长标题，带有强烈反差）。
  2. 主角：必须是高智商、杀伐果断或有独特金手指，拒绝圣母。
  3. 世界观：新颖，有冲突点。
  4. 爽点：明确列出核心爽点。
  5. 推荐总章节数（targetChapterCount）：通常在 80-200 章之间。
  6. 推荐单章字数（targetWordCount）：通常在 2500-3500 字之间。
  
  请严格按照JSON格式返回。
  `;

  return callAIWithRetry(async () => {
    // Note: Thinking config removed for JSON tasks to prevent timeouts/format errors
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            genre: { type: Type.STRING },
            tone: { type: Type.STRING },
            protagonist: { type: Type.STRING },
            worldSetting: { type: Type.STRING },
            writingStyle: { type: Type.STRING },
            targetChapterCount: { type: Type.NUMBER },
            targetWordCount: { type: Type.NUMBER },
            additionalNotes: { type: Type.STRING },
          },
          required: ["title", "genre", "protagonist", "worldSetting", "writingStyle"],
        },
      },
    });
    
    try {
      return JSON.parse(cleanJson(response.text || "{}")) as NovelConfig;
    } catch (e) {
      console.error("JSON Parse Error", response.text);
      throw new Error("AI生成格式错误，请重试");
    }
  });
};

export const generateOutline = async (apiKey: string, config: NovelConfig): Promise<string> => {
  const ai = getAI(apiKey);
  
  const prompt = `
  我需要一部小说的大纲。
  
  【基本信息】
  标题：${config.title}
  类型：${config.genre}
  基调：${config.tone}
  主角设定：${config.protagonist}
  世界观：${config.worldSetting}
  写作要求：${config.writingStyle}
  预计篇幅：约 ${config.targetChapterCount} 章
  其他备注：${config.additionalNotes}

  【要求】
  1. 请生成一份详细的故事大纲，包括起承转合。
  2. 明确指出核心冲突、高潮和结局。
  3. 必须设计2-3个贯穿全文的伏笔（草蛇灰线）。
  4. 确保主角展现出高智商或独特的解决问题能力，逻辑必须闭环。
  5. 节奏参考网文黄金三章法则，开篇即高潮。
  `;

  return callAIWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingBudget: 4096 }, // Keep thinking for creative tasks
      },
    });
    return response.text || "生成失败，请重试。";
  });
};

/**
 * Generates a batch of chapter titles and summaries.
 * Optimized for calling in a loop to generate massive chapter lists.
 */
export const generateChapterBatch = async (
  apiKey: string, 
  config: NovelConfig, 
  outline: string,
  startChapterIndex: number,
  batchSize: number,
  previousChaptersContext: Chapter[]
): Promise<Chapter[]> => {
  const ai = getAI(apiKey);

  // Construct context from previous chapters (last 5 is usually enough for continuity of titles)
  const prevContextStr = previousChaptersContext.length > 0 
    ? previousChaptersContext.slice(-5).map((c, i) => `第 ${startChapterIndex - 5 + i + 1} 章：${c.title} (${c.summary})`).join("\n")
    : "无（这是第一批章节）";

  const prompt = `
  请基于大纲，为小说《${config.title}》设计接下来的章节目录。
  
  【当前任务】
  请生成从第 ${startChapterIndex + 1} 章 到 第 ${startChapterIndex + batchSize} 章的目录。
  
  【小说大纲】
  ${outline.substring(0, 1500)}...

  【上文章节承接（参考风格和剧情进度）】
  ${prevContextStr}

  【要求】
  1. 严格返回 JSON 数组。
  2. 包含 ${batchSize} 个对象，每个对象有 "title" 和 "summary"。
  3. 标题风格：${config.genre}网文风格，吸引眼球，设置悬念。
  4. 剧情简介(summary)：包含本章核心事件、冲突点和结尾钩子。
  `;

  return callAIWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
            },
            required: ["title", "summary"],
          },
        },
        // Removed thinkingConfig for JSON list generation to ensure reliability
      },
    });

    try {
      const data = JSON.parse(cleanJson(response.text || "[]"));
      if (!Array.isArray(data)) return [];
      
      return data.map((item: any) => ({
        id: crypto.randomUUID(),
        title: item.title,
        summary: item.summary,
        content: "",
        isGenerated: false,
      }));
    } catch (e) {
       console.error("JSON Batch Parse Error", e);
       return [];
    }
  });
};

export const generateChapterContent = async (
  apiKey: string,
  config: NovelConfig,
  currentChapter: Chapter,
  previousContext: string,
  outline: string
): Promise<string> => {
  const ai = getAI(apiKey);

  const prompt = `
  你正在撰写小说《${config.title}》的正文。
  
  【当前章节】
  章节名：${currentChapter.title}
  本章剧情梗概：${currentChapter.summary}
  
  【前情提要/上文剧情】
  （非常重要：必须紧密承接以下内容，场景、状态、物品必须一致）
  ${previousContext}
  
  【整体大纲背景】
  ${outline.substring(0, 800)}...
  
  【写作指令 - 必须严格执行】
  1. **字数要求**：目标 ${config.targetWordCount} 字左右。请写长，不要草草了事。
  2. **沉浸式视角**：直接进入场景，描写环境、光影、气味、声音。不要写“主角做了什么”，要写“他看到了什么，感觉到了什么”。
  3. **对话驱动**：通过人物对话来交代信息和推动剧情，不要用大段的旁白说明。
  4. **细节描写**：
     - 不要说“他很生气”，要写“他握着茶杯的手指关节泛白，青筋暴起”。
     - 不要说“这是一个恐怖的地方”，要描写“墙壁上渗出的黑水散发着腐烂的腥味”。
  5. **网文节奏**：
     - 开篇：三句话内进入冲突或场景。
     - 结尾：必须设置悬念（断章），让人欲罢不能。
  6. **禁止项**：
     - 禁止出现“本章完”、“下一章”等字样。
     - 禁止使用“综上所述”、“总之”等总结性词汇。
     - 禁止像写剧本一样列大纲，必须是完整的小说正文。
  `;

  return callAIWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        // High budget for quality, but retries handle timeouts
        thinkingConfig: { thinkingBudget: 8192 }, 
      },
    });
    return response.text || "生成内容为空。";
  });
};
