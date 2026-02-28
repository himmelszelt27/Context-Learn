import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

export async function generateVocabulary(level: string, text: string) {
  const prompt = `The user has provided the following text:
"${text}"

Your task is to extract EXACTLY 15 key vocabulary words from this text for an English learning app.

The student's level (${level}) indicates that the user has learned English up to this point, but might need to review words at this level, and definitely needs to learn words above this level.
Therefore, you MUST follow these STRICT Vocabulary Highlighting Rules based on the user's level (${level}):
- "高中": Do NOT highlight 初中 (Middle School) and below. Highlight 高中 (High School) level words and above.
- "四级": Do NOT highlight 高中 (High School) and below. Highlight 四级 (CET-4) level words and above.
- "六级": Do NOT highlight 四级 (CET-4) and below. Highlight 六级 (CET-6) level words and above.
- "考研": Do NOT highlight 四级 (CET-4) and below. Highlight 考研 (Postgrad) level words and above.
- "专四": Do NOT highlight 六级/考研 (CET-6/Postgrad) and below. Highlight 专四 (TEM-4) level words and above.
- "专八": Do NOT highlight 专四 (TEM-4) and below. Highlight 专八 (TEM-8) level words and above.
- "雅思托福": Highlight 雅思托福 (IELTS/TOEFL) and academic/low-frequency words.

If there are fewer than 15 candidates, extract as many as possible. If there are many candidates, prioritize words with high daily usage frequency, words crucial for understanding the text, and words with rich collocations.

For each word, provide a detailed dictionary entry focusing on its usage in the specific context of the provided text.
For 'meaning', 'scenario', and 'contextExplanation', provide the English explanation, and also provide the Chinese translation in 'meaningCn', 'scenarioCn', and 'contextExplanationCn'.

IMPORTANT: For the 'word' field, you MUST provide the EXACT string as it appears in the English text (including tense, pluralization, etc.). This is crucial for highlighting the words in the text using exact string matching.

Return the result as a JSON object containing an array of these words.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          previewWords: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                lemma: { type: Type.STRING, description: "base form of the word" },
                phonetic: { type: Type.STRING },
                partOfSpeech: { type: Type.STRING },
                meaning: { type: Type.STRING, description: "Short Chinese meaning for preview" },
                exampleEn: { type: Type.STRING, description: "Bilingual example sentence (English)" },
                exampleCn: { type: Type.STRING, description: "Bilingual example sentence (Chinese)" },
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
              required: ["word", "lemma", "phonetic", "partOfSpeech", "meaning", "exampleEn", "exampleCn", "definitions", "contextIndex", "contextExplanation", "contextExplanationCn", "collocations"],
            },
          },
        },
        required: ["previewWords"],
      },
    },
  });

  const responseText = response.text || "{}";
  const data = parseJSON(responseText);
  return {
    previewWords: data.previewWords || data.words || data.vocabulary || (Array.isArray(data) ? data : [])
  };
}

export async function generateReadingMaterials(level: string, text: string) {
  const prompt = `The user has provided the following text:
"${text}"

Your task is to process this text for an English learning app.
CRITICAL RULES:
1. DO NOT rewrite, expand, or summarize the original text. The original meaning must remain exactly the same.
2. If the user provided Chinese text, translate it into English. The English translation MUST be written in the highly literary, natural, and expressive style of a native English speaker writing a novel.
3. If the user provided English text, keep the English text EXACTLY unchanged. Provide a highly accurate Chinese translation.
4. The English text and Chinese translation must be identical regardless of the student's level (${level}).

The student's level (${level}) indicates that the user has learned English up to this point, but might need to review words at this level, and definitely needs to learn words above this level.
Therefore, you MUST follow these STRICT Vocabulary Highlighting Rules based on the user's level (${level}):
- "高中": Do NOT highlight 初中 (Middle School) and below. Highlight 高中 (High School) level words and above.
- "四级": Do NOT highlight 高中 (High School) and below. Highlight 四级 (CET-4) level words and above.
- "六级": Do NOT highlight 四级 (CET-4) and below. Highlight 六级 (CET-6) level words and above.
- "考研": Do NOT highlight 四级 (CET-4) and below. Highlight 考研 (Postgrad) level words and above.
- "专四": Do NOT highlight 六级/考研 (CET-6/Postgrad) and below. Highlight 专四 (TEM-4) level words and above.
- "专八": Do NOT highlight 专四 (TEM-4) and below. Highlight 专八 (TEM-8) level words and above.
- "雅思托福": Highlight 雅思托福 (IELTS/TOEFL) and academic/low-frequency words.

Provide the following:
1. A paragraph-by-paragraph breakdown containing the English text and its Chinese translation.
2. 4-6 key phrases/idioms (MUST contain at least 2 words, e.g., 'look forward to', 'in terms of') used in the English text (appropriate for the ${level} level and above), with their Chinese meaning, the original sentence they appeared in, and 2 synonyms.
3. 1 to 2 key grammar patterns, sentence structures, or rhetorical devices used in the English text. CRITICAL: The difficulty MUST strictly match the ${level} level. For advanced levels (e.g., IELTS, TOEFL, 专八), extract complex structures like inversions, subjunctive mood, non-finite clauses, or advanced phrasing. For beginner levels, focus on fundamental rules. Provide the English explanation and its Chinese translation, the original sentence and its Chinese translation, and a new daily life example sentence and its Chinese translation.

IMPORTANT: For the 'phrase' field, you MUST provide the EXACT string as it appears in the English text (including tense, pluralization, etc.). This is crucial for highlighting the words in the text using exact string matching.

Return the result as a JSON object.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
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
          phrases: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                phrase: { type: Type.STRING },
                meaning: { type: Type.STRING },
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
              required: ["phrase", "meaning", "sourceText", "synonyms"],
            },
          },
          grammar: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pattern: { type: Type.STRING },
                explanation: { type: Type.STRING },
                explanationCn: { type: Type.STRING },
                originalSentence: { type: Type.STRING },
                originalSentenceCn: { type: Type.STRING },
                exampleSentence: { type: Type.STRING },
                exampleSentenceCn: { type: Type.STRING },
              },
              required: ["pattern", "explanation", "explanationCn", "originalSentence", "originalSentenceCn", "exampleSentence", "exampleSentenceCn"],
            },
          },
        },
        required: ["paragraphs", "phrases", "grammar"],
      },
    },
  });

  const responseText = response.text || "{}";
  const data = parseJSON(responseText);
  return {
    paragraphs: data.paragraphs || data.paragraph || (Array.isArray(data) ? data : []),
    phrases: data.phrases || data.phrase || [],
    grammar: data.grammar || data.grammars || []
  };
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
