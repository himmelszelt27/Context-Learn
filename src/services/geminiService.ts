import { GoogleGenAI, Type } from "@google/genai";

const apiKey = ((import.meta as any).env.VITE_GEMINI_API_KEY as string) || "";
const ai = new GoogleGenAI({ apiKey: apiKey });

function parseJSON(text: string) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from markdown blocks
    const match = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e2) {
        // Fallback
      }
    }
    // Try to find the first { or [ and last } or ]
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    
    let start = -1;
    let end = -1;
    
    if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = lastBrace + 1;
    } else if (firstBracket !== -1 && lastBracket !== -1) {
      start = firstBracket;
      end = lastBracket + 1;
    }
    
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(text.substring(start, end));
      } catch (e3) {
        console.error("Failed to parse JSON even after extraction", text);
      }
    }
    
    console.error("Failed to parse JSON", text);
    return {};
  }
}

export async function generateLesson(level: string, text: string) {
  if (!text || text.trim().length < 10) {
    throw new Error("输入内容太短，请提供更丰富的内容（建议50字以上）");
  }

  const prompt = `...`; // (保持原有 prompt 不变，这里仅示意结构)

  // 自动重试逻辑：最多尝试 2 次
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `The user has provided the following text: "${text}". Student level: ${level}. ${prompt}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              paragraphs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    english: { type: Type.STRING },
                    chinese: { type: Type.STRING },
                  },
                  required: ["english", "chinese"],
                },
              },
              previewWords: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    word: { type: Type.STRING },
                    lemma: { type: Type.STRING },
                    phonetic: { type: Type.STRING },
                    partOfSpeech: { type: Type.STRING },
                    meaning: { type: Type.STRING },
                    exampleEn: { type: Type.STRING },
                    exampleCn: { type: Type.STRING },
                    definitions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.INTEGER },
                          meaning: { type: Type.STRING },
                          meaningCn: { type: Type.STRING },
                          scenario: { type: Type.STRING },
                          scenarioCn: { type: Type.STRING },
                        },
                        required: ["id", "meaning", "meaningCn", "scenario", "scenarioCn"],
                      },
                    },
                    contextIndex: { type: Type.INTEGER },
                    contextExplanation: { type: Type.STRING },
                    contextExplanationCn: { type: Type.STRING },
                    collocations: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          en: { type: Type.STRING },
                          cn: { type: Type.STRING }
                        },
                        required: ["en", "cn"]
                      },
                    },
                  },
                  required: ["word", "lemma", "phonetic", "partOfSpeech", "meaning", "exampleEn", "exampleCn", "definitions", "contextIndex", "contextExplanation", "contextExplanationCn", "collocations"],
                },
              },
              phrases: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    phrase: { type: Type.STRING },
                    contextMeaningEn: { type: Type.STRING },
                    contextMeaningCn: { type: Type.STRING },
                    commonMeaningEn: { type: Type.STRING },
                    commonMeaningCn: { type: Type.STRING },
                    sourceText: { type: Type.STRING },
                    synonyms: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          word: { type: Type.STRING },
                          meaning: { type: Type.STRING },
                        },
                        required: ["word", "meaning"],
                      },
                    },
                  },
                  required: ["phrase", "contextMeaningEn", "contextMeaningCn", "commonMeaningEn", "commonMeaningCn", "sourceText", "synonyms"],
                },
              },
              grammar: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pattern: { type: Type.STRING },
                    patternCn: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    explanationCn: { type: Type.STRING },
                    originalSentence: { type: Type.STRING },
                    originalSentenceCn: { type: Type.STRING },
                    exampleSentence: { type: Type.STRING },
                    exampleSentenceCn: { type: Type.STRING },
                  },
                  required: ["pattern", "patternCn", "explanation", "explanationCn", "originalSentence", "originalSentenceCn", "exampleSentence", "exampleSentenceCn"],
                },
              },
            },
            required: ["paragraphs", "previewWords", "phrases", "grammar"],
          },
        },
      });

      const responseText = response.text || "{}";
      const data = parseJSON(responseText);
      
      return {
        paragraphs: data.paragraphs || [],
        previewWords: data.previewWords || [],
        phrases: data.phrases || [],
        grammar: data.grammar || [],
        isReadingReady: true
      };
    } catch (err: any) {
      console.error(`Attempt ${attempt} failed:`, err);
      lastError = err;
      // 如果是域名限制错误，重试可能没用，但如果是网络波动，重试很有用
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
      }
    }
  }

  // 如果两次都失败了，抛出更有意义的错误
  if (lastError?.message?.includes("API key not valid")) {
    throw new Error("API Key 权限验证失败，请检查 Google Cloud 的域名限制设置。");
  }
  throw new Error("内容生成超时或失败，请尝试缩短输入内容或稍后重试。");
}

export async function lookupWord(word: string, contextSentence: string) {
  const prompt = `The user clicked on the word '${word}' in the following sentence: '${contextSentence}'.
Provide a detailed dictionary entry for this word, focusing on its usage in this specific context.
For 'meaning', 'scenario', and 'contextExplanation', provide the English explanation, and also provide the Chinese translation in 'meaningCn', 'scenarioCn', and 'contextExplanationCn'.
Return the result as a JSON object.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          lemma: { type: Type.STRING, description: "base form of the word" },
          phonetic: { type: Type.STRING },
          partOfSpeech: { type: Type.STRING },
          definitions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER },
                meaning: { type: Type.STRING, description: "English meaning" },
                meaningCn: { type: Type.STRING, description: "Chinese meaning" },
                scenario: { type: Type.STRING, description: "English scenario" },
                scenarioCn: { type: Type.STRING, description: "Chinese scenario" },
              },
              required: ["id", "meaning", "meaningCn", "scenario", "scenarioCn"],
            },
            description: "list 2-3 common meanings, including the context meaning",
          },
          contextIndex: { type: Type.INTEGER, description: "the id of the definition that matches the context" },
          contextExplanation: { type: Type.STRING, description: "explain how the word is used in this specific sentence (in English)" },
          contextExplanationCn: { type: Type.STRING, description: "explain how the word is used in this specific sentence (in Chinese)" },
          collocations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                en: { type: Type.STRING, description: "collocation in English" },
                cn: { type: Type.STRING, description: "collocation translated to Chinese" }
              },
              required: ["en", "cn"]
            },
            description: "2-3 common collocations or phrases using this word",
          },
        },
        required: ["word", "lemma", "phonetic", "partOfSpeech", "definitions", "contextIndex", "contextExplanation", "contextExplanationCn", "collocations"],
      },
    },
  });

  const responseText = response.text || "{}";
  return parseJSON(responseText);
}
