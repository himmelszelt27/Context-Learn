import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Bookmark, User, Sparkles, Loader2, ArrowLeft, Trash2, CheckCircle2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { generateLesson, lookupWord } from './services/geminiService';

const LEVELS = ['高中', '四级', '六级', '考研', '专四', '专八', '雅思托福'];

// --- Hooks ---
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      const parsed = item ? JSON.parse(item) : null;
      return parsed !== null && parsed !== undefined ? parsed : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}

// --- Types ---
type Definition = {
  id: number;
  meaning: string;
  meaningCn?: string;
  scenario: string;
  scenarioCn?: string;
};

type VocabItem = {
  word: string;
  lemma?: string;
  phonetic: string;
  partOfSpeech: string;
  definitions: Definition[];
  contextIndex: number;
  contextExplanation: string;
  contextExplanationCn?: string;
  sourceText: string;
  collocations: (string | { en: string; cn: string })[];
  timestamp?: number;
  meaning?: string;
  exampleEn?: string;
  exampleCn?: string;
  contexts?: {
    sourceText: string;
    meaning: string;
    timestamp: number;
  }[];
};

type PhraseItem = {
  phrase: string;
  contextMeaningEn: string;
  contextMeaningCn: string;
  commonMeaningEn: string;
  commonMeaningCn: string;
  contextTags?: string[];
  sourceText: string;
  synonyms: { word: string; meaning: string }[];
  timestamp?: number;
  contexts?: {
    sourceText: string;
    meaning: string;
    timestamp: number;
  }[];
  // Legacy fields for backward compatibility
  meaning?: string;
  literalMeaning?: string;
};

type PreviewWord = {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  exampleEn: string;
  exampleCn: string;
};

type SentencePattern = {
  pattern: string;
  patternCn?: string;
  explanation: string;
  explanationCn?: string;
  originalSentence: string;
  originalSentenceCn?: string;
  exampleSentence: string;
  exampleSentenceCn?: string;
};

type AppData = {
  paragraphs: { english: string; chinese: string }[];
  previewWords: PreviewWord[];
  vocabulary: VocabItem[];
  phrases: PhraseItem[];
  grammar: SentencePattern[];
};

// --- Main App ---
export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [view, setView] = useState('main'); // 'main', 'preview', 'reading'
  const [level, setLevel] = useLocalStorage('contextlearn_level', '四级');
  const [savedVocab, setSavedVocab] = useLocalStorage<VocabItem[]>('contextlearn_vocab', []);
  const [savedPhrases, setSavedPhrases] = useLocalStorage<PhraseItem[]>('contextlearn_phrases', []);
  const [stats, setStats] = useLocalStorage('contextlearn_stats', { learnedCount: 0 });
  const [isDarkMode, setIsDarkMode] = useLocalStorage('contextlearn_dark_mode', true);
  const [lessonData, setLessonData] = useState<any>(null);
  const [currentText, setCurrentText] = useState('');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleStartLearning = async (text: string) => {
    setCurrentText(text);
    setLessonData(null);
    setView('preview');
    setStats(s => ({ ...s, learnedCount: s.learnedCount + 1 }));
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-zinc-950 text-[#1D1D1F] dark:text-zinc-50 font-sans selection:bg-indigo-500/30 transition-colors duration-300">
      <main className={view === 'main' ? "pb-20" : ""}>
        <AnimatePresence mode="wait">
          {view === 'main' && (
            <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {activeTab === 'home' && <HomeView level={level} setLevel={setLevel} onStart={handleStartLearning} />}
              {activeTab === 'vocab' && <VocabView savedVocab={savedVocab} setSavedVocab={setSavedVocab} savedPhrases={savedPhrases} setSavedPhrases={setSavedPhrases} />}
              {activeTab === 'profile' && <ProfileView level={level} setLevel={setLevel} stats={stats} savedCount={(savedVocab?.length || 0) + (savedPhrases?.length || 0)} setSavedVocab={setSavedVocab} setSavedPhrases={setSavedPhrases} setStats={setStats} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />}
            </motion.div>
          )}
          {view === 'preview' && (
            <motion.div key="preview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <PreviewView level={level} text={currentText} onComplete={() => setView('reading')} onBack={() => setView('main')} lessonData={lessonData} setLessonData={setLessonData} />
            </motion.div>
          )}
          {view === 'reading' && (
            <motion.div key="reading" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <ReadingView onBack={() => setView('main')} savedVocab={savedVocab} setSavedVocab={setSavedVocab} savedPhrases={savedPhrases} setSavedPhrases={setSavedPhrases} lessonData={lessonData} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {view === 'main' && (
          <motion.nav 
            initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 bg-[#F5F5F7]/80 dark:bg-zinc-950/80 backdrop-blur-xl border-t border-black/5 dark:border-white/5 pb-safe z-50 transition-colors duration-300"
          >
            <div className="flex justify-around items-center h-16 px-4 max-w-md mx-auto">
              <NavItem icon={<BookOpen className="w-5 h-5" />} label="首页" isActive={activeTab === 'home'} onClick={() => setActiveTab('home')} />
              <NavItem icon={<Bookmark className="w-5 h-5" />} label="生词本" isActive={activeTab === 'vocab'} onClick={() => setActiveTab('vocab')} />
              <NavItem icon={<User className="w-5 h-5" />} label="我的" isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors active:scale-95 ${
        isActive ? 'text-indigo-400' : 'text-[#6E6E73] dark:text-zinc-500 hover:text-[#6E6E73] dark:text-zinc-400'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

// --- Home View ---
function HomeView({ level, setLevel, onStart }: { level: string, setLevel: (l: string) => void, onStart: (text: string) => void }) {
  const [text, setText] = useState('');
  const MAX_CHARS = 1500;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_CHARS) {
      setText(val);
    } else {
      setText(val.slice(0, MAX_CHARS));
    }
  };

  return (
    <div className="px-5 pt-12 pb-6 max-w-md mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
          ContextLearn
        </h1>
        <p className="text-[#6E6E73] dark:text-zinc-400 text-sm mt-2">用熟悉的内容学英语</p>
      </header>

      <div className="space-y-8">
        <section>
          <h2 className="text-sm font-medium text-[#1D1D1F] dark:text-zinc-300 mb-3 flex items-center"><span className="mr-2">📊</span> 当前词汇量水平</h2>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map(l => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                  level === l 
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' 
                    : 'bg-zinc-100/50 dark:bg-zinc-800/50 text-[#6E6E73] dark:text-zinc-400 hover:bg-zinc-100 dark:bg-zinc-800 hover:text-[#1D1D1F] dark:text-zinc-200 border border-black/5 dark:border-white/5'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="flex justify-between items-end mb-3">
            <h2 className="text-sm font-medium text-[#1D1D1F] dark:text-zinc-300 flex items-center"><span className="mr-2">📝</span> 粘贴你想学的中文段落</h2>
          </div>
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
            <textarea
              value={text}
              onChange={handleTextChange}
              placeholder="在这里粘贴你想学的中文内容，建议500-1500字，比如一段小说、一篇文章..."
              className="relative w-full h-48 bg-white/80 dark:bg-zinc-900/80 border border-black/10 dark:border-white/10 rounded-2xl p-4 text-[#1D1D1F] dark:text-zinc-100 placeholder:text-[#8E8E93] dark:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none leading-relaxed shadow-inner text-sm"
            />
          </div>
          <div className="flex justify-end mt-2">
            <span className={`text-xs ${text.length >= MAX_CHARS ? 'text-red-400' : 'text-[#6E6E73] dark:text-zinc-500'}`}>
              当前 {text.length} / {MAX_CHARS} 字
            </span>
          </div>
        </section>

        <button
          onClick={() => onStart(text)}
          disabled={!text.trim()}
          className="w-full relative group overflow-hidden rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed mt-4 active:scale-[0.98] transition-transform"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 transition-transform duration-300 group-hover:scale-105"></div>
          <div className="relative flex items-center justify-center space-x-2 px-6 py-4">
            <Sparkles className="w-5 h-5 text-white" />
            <span className="text-white font-medium text-lg tracking-wide">开始学习</span>
          </div>
        </button>
      </div>
    </div>
  );
}

// --- Preview View ---
function PreviewView({ level, text, onComplete, onBack, lessonData, setLessonData }: { level: string, text: string, onComplete: () => void, onBack: () => void, lessonData: any, setLessonData: any }) {
  const [progress, setProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingForReading, setWaitingForReading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  const loadingMessages = [
    "AI 酱正在努力翻译中...",
    "正在为你挑选最地道的表达...",
    "正在分析语法结构，请稍等哦...",
    "正在把你的文字变成精美的小说...",
    "网络小精灵正在搬运数据...",
    "快好了，再等一下下嘛...",
  ];

  useEffect(() => {
    const msgTimer = setInterval(() => {
      setLoadingMsgIndex(prev => (prev + 1) % loadingMessages.length);
    }, 3000);
    return () => clearInterval(msgTimer);
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    if (!lessonData) {
      const fetchLesson = async () => {
        try {
          const lesson = await generateLesson(level, text);
          if (isMounted) {
            setLessonData(lesson);
            setIsDone(true);
            setProgress(100);
          }
        } catch (err: any) {
          console.error(err);
          if (isMounted) setError(err.message || "生成失败了 QAQ");
        }
      };

      fetchLesson();
      
      const timer = setInterval(() => {
        setProgress(p => {
          if (p >= 90) return p;
          return p + Math.random() * 5;
        });
      }, 500);
      
      return () => {
        isMounted = false;
        clearInterval(timer);
      };
    } else {
      if (lessonData.previewWords) {
        setIsDone(true);
        setProgress(100);
      }
    }
  }, [level, text]);

  useEffect(() => {
    if (waitingForReading && lessonData?.isReadingReady) {
      onComplete();
    }
  }, [waitingForReading, lessonData?.isReadingReady, onComplete]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 max-w-md mx-auto text-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white/80 dark:bg-zinc-900/80 p-8 rounded-3xl border border-black/5 dark:border-white/5 shadow-2xl"
        >
          <div className="text-5xl mb-6">QAQ</div>
          <h3 className="text-xl font-bold mb-3 text-[#1D1D1F] dark:text-zinc-100">哎呀，生成失败了...</h3>
          <p className="text-sm text-[#6E6E73] dark:text-zinc-400 mb-8 leading-relaxed">
            可能是 AI 酱刚才走神了，或者是网络小精灵在捣乱。<br />
            如果是第一次使用，<span className="text-indigo-500 font-bold">刷新一下页面</span>通常就能好哦！
          </p>
          <div className="flex flex-col space-y-3">
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/25 active:scale-95 transition-transform flex items-center justify-center"
            >
              刷新页面试试
            </button>
            <button 
              onClick={onBack} 
              className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-[#6E6E73] dark:text-zinc-400 rounded-2xl font-medium active:scale-95 transition-transform"
            >
              返回修改内容
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-5 pt-16 pb-10 max-w-md mx-auto relative">
      <button 
        onClick={onBack} 
        className="absolute top-4 left-4 p-2 text-[#6E6E73] dark:text-zinc-400 hover:text-[#1D1D1F] dark:text-zinc-100 transition-colors flex items-center active:scale-95"
      >
        <ArrowLeft className="w-5 h-5 mr-1" />
        <span className="text-sm">返回</span>
      </button>
      <div className="mb-8 mt-4">
        <h2 className="text-2xl font-bold text-[#1D1D1F] dark:text-zinc-100 flex items-center mb-2"><span className="mr-2">📖</span> 阅读前先认识这些词</h2>
        <p className="text-[#6E6E73] dark:text-zinc-400 text-sm">
          {lessonData?.previewWords ? `共 ${lessonData.previewWords?.length || 0} 个 · 基于「${level}」筛选` : '正在为您量身定制阅读材料...'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide pb-24">
        {lessonData?.previewWords?.map((item: any, i: number) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white/60 dark:bg-zinc-900/60 border border-black/5 dark:border-white/5 rounded-2xl p-4 shadow-lg"
          >
            <div className="flex items-baseline space-x-2 mb-2">
              <span className="text-xl font-bold text-blue-600 dark:text-indigo-300">{item.word}</span>
              <span className="text-xs text-[#6E6E73] dark:text-zinc-500 font-mono">{item.phonetic}</span>
              <span className="text-xs text-blue-500 dark:text-indigo-400/70 font-medium">{item.partOfSpeech}</span>
            </div>
            <div className="text-sm text-[#1D1D1F] dark:text-zinc-300 font-medium mb-3">{item.meaning}</div>
            <div className="bg-[#F5F5F7]/50 dark:bg-zinc-950/50 rounded-lg p-3 border border-black/5 dark:border-white/5">
              <div className="text-sm text-[#1D1D1F] dark:text-zinc-300 italic mb-1 flex items-start"><span className="mr-2 mt-0.5">💬</span> {item.exampleEn}</div>
              <div className="text-xs text-[#6E6E73] dark:text-zinc-500 ml-6">{item.exampleCn}</div>
            </div>
          </motion.div>
        ))}
        
        {!lessonData?.previewWords && (
          <div className="flex flex-col items-center justify-center py-20 text-[#6E6E73] dark:text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
            <AnimatePresence mode="wait">
              <motion.p 
                key={loadingMsgIndex}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-sm"
              >
                {loadingMessages[loadingMsgIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#F5F5F7] via-[#F5F5F7]/90 dark:from-zinc-950 dark:via-zinc-950/90 to-transparent">
        <div className="max-w-md mx-auto">
          {!isDone ? (
            <div className="space-y-3">
              <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-center text-sm text-[#1D1D1F] dark:text-zinc-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4 mr-2 text-indigo-400 animate-pulse" />
                ✨ {loadingMessages[loadingMsgIndex]} {Math.round(progress)}%
              </div>
            </div>
          ) : (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => {
                if (lessonData?.isReadingReady) {
                  onComplete();
                } else {
                  setWaitingForReading(true);
                }
              }}
              disabled={waitingForReading}
              className={`w-full relative group overflow-hidden rounded-2xl transition-transform ${waitingForReading ? 'opacity-80 cursor-not-allowed' : 'active:scale-[0.98]'}`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 transition-transform duration-300 group-hover:scale-105"></div>
              <div className="relative flex items-center justify-center space-x-2 px-6 py-4">
                {waitingForReading ? (
                  <>
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                    <span className="text-white font-medium text-lg tracking-wide">正在生成阅读材料...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    <span className="text-white font-medium text-lg tracking-wide">开始阅读</span>
                  </>
                )}
              </div>
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Reading View ---
function ReadingView({ onBack, savedVocab, setSavedVocab, savedPhrases, setSavedPhrases, lessonData }: { onBack: () => void, savedVocab: VocabItem[], setSavedVocab: any, savedPhrases: PhraseItem[], setSavedPhrases: any, lessonData: any }) {
  const [mode, setMode] = useState<'en' | 'bilingual'>('en');
  const [selectedWord, setSelectedWord] = useState<VocabItem | null>(null);
  const [selectedPhrase, setSelectedPhrase] = useState<PhraseItem | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [showChinese, setShowChinese] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleUnknownWordClick = async (word: string, sourceText: string, initialData?: any) => {
    setIsLookingUp(true);
    setShowChinese(false);
    
    // Check if we already have full dictionary data from previewWords
    if (initialData && initialData.definitions && initialData.definitions?.length > 0) {
      setSelectedWord({
        ...initialData,
        sourceText: sourceText
      });
      setIsLookingUp(false);
      return;
    }

    setSelectedWord({
      word: word,
      phonetic: initialData?.phonetic || '...',
      partOfSpeech: initialData?.partOfSpeech || '...',
      definitions: [],
      contextIndex: 0,
      contextExplanation: '正在查询中...',
      sourceText: sourceText,
      collocations: []
    });

    try {
      const data = await lookupWord(word, sourceText);
      setSelectedWord({
        ...data,
        sourceText: sourceText
      });
    } catch (err) {
      console.error(err);
      setSelectedWord({
        word: word,
        phonetic: initialData?.phonetic || '...',
        partOfSpeech: initialData?.partOfSpeech || '...',
        definitions: [{ id: 1, meaning: "查询失败，请重试", scenario: "" }],
        contextIndex: 1,
        contextExplanation: "查询失败",
        sourceText: sourceText,
        collocations: []
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  // Helper to highlight words and phrases in text
  const renderHighlightedText = (text: string, paragraphIndex: number) => {
    let result: React.ReactNode[] = [text];
    
    const escapeRegExp = (string: string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // Highlight phrases first (longer matches)
    if (lessonData?.phrases) {
      lessonData.phrases?.forEach((phrase: any, phraseIdx: number) => {
        const newResult: React.ReactNode[] = [];
        const escapedPhrase = escapeRegExp(phrase.phrase);
        const regex = new RegExp(`\\b(${escapedPhrase})\\b`, 'gi');
        
        result.forEach((part, i) => {
          if (typeof part === 'string') {
            const splits = part.split(regex);
            splits.forEach((split, j) => {
              if (split.toLowerCase() === phrase.phrase.toLowerCase()) {
                newResult.push(
                  <span 
                    key={`phrase-${phraseIdx}-${i}-${j}`}
                    onClick={() => {
                      setSelectedPhrase({...phrase});
                      setShowChinese(false);
                    }}
                    className="bg-[#D1FAE5] text-[#065F46] dark:bg-emerald-500/20 dark:text-emerald-200 rounded px-1 cursor-pointer hover:bg-[#A7F3D0] dark:hover:bg-emerald-500/40 transition-colors active:bg-[#6EE7B7] dark:active:bg-emerald-500/50"
                  >
                    {split}
                  </span>
                );
              } else if (split) {
                newResult.push(split);
              }
            });
          } else {
            newResult.push(part);
          }
        });
        result = newResult;
      });
    }

    // Then highlight vocabulary words
    if (lessonData?.previewWords) {
      lessonData.previewWords?.forEach((vocab: any, vocabIdx: number) => {
        const newResult: React.ReactNode[] = [];
        const escapedWord = escapeRegExp(vocab.word);
        const regex = new RegExp(`\\b(${escapedWord})\\b`, 'gi');
        
        result.forEach((part, i) => {
          if (typeof part === 'string') {
            const splits = part.split(regex);
            splits.forEach((split, j) => {
              if (split.toLowerCase() === vocab.word.toLowerCase()) {
                newResult.push(
                  <span 
                    key={`vocab-${vocabIdx}-${i}-${j}`}
                    onClick={() => handleUnknownWordClick(split, lessonData.paragraphs[paragraphIndex].english, vocab)}
                    className="bg-[#DBEAFE] text-[#1E40AF] dark:bg-indigo-500/20 dark:text-indigo-200 rounded px-1 cursor-pointer hover:bg-[#BFDBFE] dark:hover:bg-indigo-500/40 transition-colors active:bg-[#93C5FD] dark:active:bg-indigo-500/50"
                  >
                    {split}
                  </span>
                );
              } else if (split) {
                newResult.push(split);
              }
            });
          } else {
            newResult.push(part);
          }
        });
        result = newResult;
      });
    }
    
    // Finally, make all OTHER words clickable
    const finalResult: React.ReactNode[] = [];
    result.forEach((part, i) => {
      if (typeof part === 'string') {
        const wordsAndPunctuation = part.split(/([a-zA-Z]+(?:'[a-zA-Z]+)?)/g);
        wordsAndPunctuation.forEach((token, j) => {
          if (/^[a-zA-Z]+(?:'[a-zA-Z]+)?$/.test(token)) {
            finalResult.push(
              <span 
                key={`word-${i}-${j}`}
                onClick={() => handleUnknownWordClick(token, lessonData.paragraphs[paragraphIndex].english)}
                className="cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors active:bg-black/10 dark:active:bg-white/20"
              >
                {token}
              </span>
            );
          } else if (token) {
            finalResult.push(token);
          }
        });
      } else {
        finalResult.push(part);
      }
    });
    
    return finalResult;
  };

  if (!lessonData) return null;

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-zinc-950 pb-24 relative">
      <div className="sticky top-0 z-20 bg-[#F5F5F7]/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-black/5 dark:border-white/5 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-[#6E6E73] dark:text-zinc-400 hover:text-[#1D1D1F] dark:text-zinc-100 transition-colors flex items-center active:scale-95">
          <ArrowLeft className="w-5 h-5 mr-1" />
          <span className="text-sm">返回</span>
        </button>
        
        <div className="flex bg-white dark:bg-zinc-900 rounded-lg p-1 border border-black/5 dark:border-white/5">
          <button 
            onClick={() => setMode('en')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === 'en' ? 'bg-zinc-100 dark:bg-zinc-800 text-[#1D1D1F] dark:text-zinc-100 shadow-sm' : 'text-[#6E6E73] dark:text-zinc-500'}`}
          >
            英文
          </button>
          <button 
            onClick={() => setMode('bilingual')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === 'bilingual' ? 'bg-zinc-100 dark:bg-zinc-800 text-[#1D1D1F] dark:text-zinc-100 shadow-sm' : 'text-[#6E6E73] dark:text-zinc-500'}`}
          >
            中英对照
          </button>
        </div>
        <div className="w-16"></div>
      </div>

      <div className="px-5 pt-6 max-w-md mx-auto space-y-6">
        {lessonData?.paragraphs?.map((p: any, i: number) => (
          <div key={i} className="space-y-2">
            <p className="text-lg leading-relaxed text-[#1D1D1F] dark:text-zinc-200 font-serif">
              {renderHighlightedText(p.english, i)}
            </p>
            {mode === 'bilingual' && (
              <p className="text-sm leading-relaxed text-[#6E6E73] dark:text-zinc-500">
                {p.chinese}
              </p>
            )}
          </div>
        ))}

        {/* Grammar Section */}
        {lessonData?.grammar && lessonData.grammar?.length > 0 && (
          <div className="mt-8 pt-8 border-t border-black/5 dark:border-white/5 pb-8">
            <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-zinc-300 mb-4 flex items-center"><span className="mr-2">✨</span> 造句技巧</h3>
            <div className="space-y-4">
              {lessonData?.grammar?.map((grammarItem: any, idx: number) => (
                <div key={idx} className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 rounded-2xl p-5 border border-blue-100 dark:border-indigo-500/20">
                  <div className="mb-3">
                    <div className="text-lg font-bold text-blue-600 dark:text-indigo-300">{grammarItem.pattern}</div>
                    {mode === 'bilingual' && grammarItem.patternCn && (
                      <div className="text-base font-medium text-blue-500/80 dark:text-indigo-400/80 mt-0.5">{grammarItem.patternCn}</div>
                    )}
                  </div>
                  <div className="text-sm text-[#1D1D1F] dark:text-zinc-300 mb-4 leading-relaxed">
                    {grammarItem.explanation}
                    {mode === 'bilingual' && grammarItem.explanationCn && (
                      <div className="mt-2 text-[#6E6E73] dark:text-zinc-400">{grammarItem.explanationCn}</div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-blue-500/70 dark:text-indigo-400/70 mb-1 uppercase tracking-wider">原文例句</div>
                      <div className="text-sm text-[#1D1D1F] dark:text-zinc-300 italic">"{grammarItem.originalSentence}"</div>
                      {mode === 'bilingual' && grammarItem.originalSentenceCn && (
                        <div className="text-sm text-[#6E6E73] dark:text-zinc-500 mt-1">{grammarItem.originalSentenceCn}</div>
                      )}
                    </div>
                    <div className="h-px w-full bg-black/5 dark:bg-white/5"></div>
                    <div>
                      <div className="text-xs text-purple-500/70 dark:text-purple-400/70 mb-1 uppercase tracking-wider">日常例句</div>
                      <div className="text-sm text-[#1D1D1F] dark:text-zinc-300 italic">"{grammarItem.exampleSentence}"</div>
                      {mode === 'bilingual' && grammarItem.exampleSentenceCn && (
                        <div className="text-sm text-[#6E6E73] dark:text-zinc-500 mt-1">{grammarItem.exampleSentenceCn}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sheet */}
      <AnimatePresence>
        {selectedWord && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedWord(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-black/10 dark:border-white/10 rounded-t-3xl z-50 p-6 max-w-md mx-auto pb-safe max-h-[85vh] overflow-y-auto scrollbar-hide"
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, info) => {
                if (info.offset.y > 100) setSelectedWord(null);
              }}
            >
              <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full mx-auto mb-6 opacity-50"></div>
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-baseline space-x-2 mb-1">
                    <h3 className="text-3xl font-bold text-[#1D1D1F] dark:text-zinc-100">{selectedWord.lemma || selectedWord.word}</h3>
                    <span className="text-blue-500 dark:text-indigo-400 text-sm font-medium">{selectedWord.partOfSpeech}</span>
                  </div>
                  <span className="text-[#6E6E73] dark:text-zinc-400 font-mono text-sm">{selectedWord.phonetic}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => setShowChinese(!showChinese)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${showChinese ? 'bg-indigo-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-[#6E6E73] dark:text-zinc-400 hover:text-white'}`}
                  >
                    {showChinese ? '隐藏中文' : '显示中文'}
                  </button>
                  <button onClick={() => setSelectedWord(null)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[#6E6E73] dark:text-zinc-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-6 mb-8">
                {/* Context Meaning */}
                <div className="bg-blue-50 dark:bg-indigo-500/10 rounded-xl p-4 border border-blue-100 dark:border-indigo-500/20">
                  <div className="text-sm font-medium text-blue-600 dark:text-indigo-300 mb-2 flex items-center">
                    <span className="mr-2">🎯</span> 语境义
                    {isLookingUp && <Sparkles className="w-3 h-3 ml-2 animate-pulse" />}
                  </div>
                  <div className="text-sm text-[#1D1D1F] dark:text-zinc-300 leading-relaxed">
                    {selectedWord.contextExplanation}
                    {showChinese && selectedWord.contextExplanationCn && (
                      <div className="mt-2 pt-2 border-t border-blue-100 dark:border-indigo-500/20 text-blue-600/80 dark:text-indigo-200/80">
                        {selectedWord.contextExplanationCn}
                      </div>
                    )}
                  </div>
                </div>

                {/* All Definitions */}
                {selectedWord.definitions && selectedWord.definitions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[#6E6E73] dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center"><span className="mr-2">📗</span> 常见释义</h4>
                    <div className="space-y-2">
                      {selectedWord.definitions.map((def) => (
                        <div key={def.id} className={`p-3 rounded-lg border ${def.id === selectedWord.contextIndex ? 'bg-zinc-100/80 dark:bg-zinc-800/80 border-indigo-500/30' : 'bg-white/50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5'}`}>
                          <div className="flex items-start">
                            <span className="text-xs font-mono text-[#6E6E73] dark:text-zinc-500 w-5 mt-0.5">{def.id}.</span>
                            <div>
                              <div className={`text-sm font-medium ${def.id === selectedWord.contextIndex ? 'text-blue-600 dark:text-indigo-300' : 'text-[#1D1D1F] dark:text-zinc-300'}`}>
                                {def.meaning}
                                {showChinese && def.meaningCn && <span className="block mt-1 text-[#6E6E73] dark:text-zinc-400 font-normal">{def.meaningCn}</span>}
                              </div>
                              <div className="text-xs text-[#6E6E73] dark:text-zinc-500 mt-1">
                                {def.scenario}
                                {showChinese && def.scenarioCn && <span className="block mt-0.5">{def.scenarioCn}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Collocations */}
                {selectedWord.collocations && selectedWord.collocations.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[#6E6E73] dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center"><span className="mr-2">📝</span> 常用搭配</h4>
                    <ul className="space-y-2">
                      {selectedWord.collocations.map((col, i) => {
                        const isObj = typeof col === 'object' && col !== null;
                        const en = isObj ? (col as any).en : col;
                        const cn = isObj ? (col as any).cn : '';
                        return (
                          <li key={i} className="text-sm text-[#1D1D1F] dark:text-zinc-300 bg-zinc-100/50 dark:bg-zinc-800/50 px-3 py-2 rounded-lg border border-black/5 dark:border-white/5">
                            <div>{en}</div>
                            {showChinese && cn && <div className="text-[#6E6E73] dark:text-zinc-500 mt-1">{cn}</div>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              {(() => {
                const existingVocab = (savedVocab || []).find(v => v.word === selectedWord.word);
                const currentDef = selectedWord.definitions?.find(d => d.id === selectedWord.contextIndex);
                const currentMeaning = currentDef?.meaningCn || currentDef?.meaning || selectedWord.meaning || '';
                
                let existingMeaning = '';
                if (existingVocab) {
                  const existingDef = existingVocab.definitions?.find(d => d.id === existingVocab.contextIndex);
                  existingMeaning = existingDef?.meaningCn || existingDef?.meaning || existingVocab.meaning || '';
                }

                const isContextAlreadySaved = existingVocab && (
                  existingVocab.sourceText === selectedWord.sourceText ||
                  existingMeaning === currentMeaning ||
                  (existingVocab.contexts || []).some(c => c.sourceText === selectedWord.sourceText || c.meaning === currentMeaning)
                );

                if (isContextAlreadySaved) {
                  return (
                    <button disabled className="w-full py-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[#6E6E73] dark:text-zinc-400 font-medium flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      已收藏
                    </button>
                  );
                }

                if (existingVocab) {
                  return (
                    <button 
                      disabled={isLookingUp}
                      onClick={() => {
                        const updatedVocabList = (savedVocab || []).map(v => {
                          if (v.word === selectedWord.word) {
                            return {
                              ...v,
                              contexts: [
                                ...(v.contexts || []),
                                {
                                  sourceText: selectedWord.sourceText,
                                  meaning: currentMeaning,
                                  timestamp: Date.now()
                                }
                              ]
                            };
                          }
                          return v;
                        });
                        setSavedVocab(updatedVocabList);
                      }}
                      className={`w-full py-4 rounded-xl font-medium flex items-center justify-center transition-transform ${isLookingUp ? 'bg-zinc-100 dark:bg-zinc-800 text-[#6E6E73] dark:text-zinc-500' : 'bg-indigo-500 text-white active:scale-[0.98]'}`}
                    >
                      <Bookmark className="w-5 h-5 mr-2" />
                      {isLookingUp ? '查询中...' : '追加新语境到生词本'}
                    </button>
                  );
                }

                return (
                  <button 
                    disabled={isLookingUp}
                    onClick={() => {
                      setSavedVocab([...(savedVocab || []), { ...selectedWord, timestamp: Date.now() }]);
                    }}
                    className={`w-full py-4 rounded-xl font-medium flex items-center justify-center transition-transform ${isLookingUp ? 'bg-zinc-100 dark:bg-zinc-800 text-[#6E6E73] dark:text-zinc-500' : 'bg-indigo-500 text-white active:scale-[0.98]'}`}
                  >
                    <Bookmark className="w-5 h-5 mr-2" />
                    {isLookingUp ? '查询中...' : '加入生词本'}
                  </button>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Phrase Bottom Sheet */}
      <AnimatePresence>
        {selectedPhrase && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedPhrase(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-black/10 dark:border-white/10 rounded-t-3xl z-50 p-6 max-w-md mx-auto pb-safe max-h-[85vh] overflow-y-auto scrollbar-hide"
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, info) => {
                if (info.offset.y > 100) setSelectedPhrase(null);
              }}
            >
              <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full mx-auto mb-6 opacity-50"></div>
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-baseline space-x-2 mb-1">
                    <h3 className="text-3xl font-bold text-[#1D1D1F] dark:text-zinc-100">{selectedPhrase.phrase}</h3>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => setShowChinese(!showChinese)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${showChinese ? 'bg-emerald-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-[#6E6E73] dark:text-zinc-400 hover:text-white'}`}
                  >
                    {showChinese ? '隐藏中文' : '显示中文'}
                  </button>
                  <button onClick={() => setSelectedPhrase(null)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[#6E6E73] dark:text-zinc-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-6 mb-8">
                {/* Context Meaning */}
                <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-4 border border-emerald-100 dark:border-emerald-500/20">
                  <div className="text-sm font-medium text-emerald-600 dark:text-emerald-300 mb-2 flex items-center">
                    <span className="mr-2">🎯</span> 语境义
                  </div>
                  <div className="text-sm text-[#1D1D1F] dark:text-zinc-300 leading-relaxed">
                    {selectedPhrase.contextMeaningEn || selectedPhrase.meaning}
                    {showChinese && selectedPhrase.contextMeaningCn && (
                      <div className="mt-2 pt-2 border-t border-emerald-100 dark:border-emerald-500/20 text-emerald-600/80 dark:text-emerald-200/80">
                        {selectedPhrase.contextMeaningCn}
                      </div>
                    )}
                  </div>
                </div>

                {/* Common Meaning */}
                <div>
                  <h4 className="text-xs font-semibold text-[#6E6E73] dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center"><span className="mr-2">📖</span> 常见释义</h4>
                  <div className="bg-white/50 dark:bg-zinc-900/50 border border-black/5 dark:border-white/5 rounded-xl p-4">
                    <div className="text-sm text-[#1D1D1F] dark:text-zinc-300">
                      {selectedPhrase.commonMeaningEn || selectedPhrase.literalMeaning || selectedPhrase.meaning}
                      {showChinese && selectedPhrase.commonMeaningCn && (
                        <div className="mt-2 text-[#6E6E73] dark:text-zinc-400">
                          {selectedPhrase.commonMeaningCn}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Synonyms */}
                {selectedPhrase.synonyms && selectedPhrase.synonyms.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[#6E6E73] dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center"><span className="mr-2">💡</span> 近义表达</h4>
                    <ul className="space-y-2">
                      {selectedPhrase.synonyms.map((syn, i) => (
                        <li key={i} className="text-sm text-[#1D1D1F] dark:text-zinc-300 bg-zinc-100/50 dark:bg-zinc-800/50 px-3 py-2 rounded-lg border border-black/5 dark:border-white/5 flex justify-between">
                          <span>{syn.word}</span>
                          <span className="text-[#6E6E73] dark:text-zinc-500">{syn.meaning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {(() => {
                const existingPhrase = (savedPhrases || []).find(p => p.phrase === selectedPhrase.phrase);
                const currentMeaning = selectedPhrase.contextMeaningCn || selectedPhrase.meaning || '';
                const isContextAlreadySaved = existingPhrase && (
                  existingPhrase.sourceText === selectedPhrase.sourceText ||
                  (existingPhrase.contextMeaningCn || existingPhrase.meaning || '') === currentMeaning ||
                  (existingPhrase.contexts || []).some(c => c.sourceText === selectedPhrase.sourceText || c.meaning === currentMeaning)
                );

                if (isContextAlreadySaved) {
                  return (
                    <button disabled className="w-full py-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[#6E6E73] dark:text-zinc-400 font-medium flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      已收藏
                    </button>
                  );
                }

                if (existingPhrase) {
                  return (
                    <button 
                      onClick={() => {
                        const updatedPhraseList = (savedPhrases || []).map(p => {
                          if (p.phrase === selectedPhrase.phrase) {
                            return {
                              ...p,
                              contexts: [
                                ...(p.contexts || []),
                                {
                                  sourceText: selectedPhrase.sourceText,
                                  meaning: currentMeaning,
                                  timestamp: Date.now()
                                }
                              ]
                            };
                          }
                          return p;
                        });
                        setSavedPhrases(updatedPhraseList);
                      }}
                      className="w-full py-4 rounded-xl bg-emerald-500 text-white font-medium flex items-center justify-center active:scale-[0.98] transition-transform"
                    >
                      <Bookmark className="w-5 h-5 mr-2" />
                      追加新语境到生词本
                    </button>
                  );
                }

                return (
                  <button 
                    onClick={() => {
                      setSavedPhrases([...(savedPhrases || []), { ...selectedPhrase, timestamp: Date.now() }]);
                    }}
                    className="w-full py-4 rounded-xl bg-emerald-500 text-white font-medium flex items-center justify-center active:scale-[0.98] transition-transform"
                  >
                    <Bookmark className="w-5 h-5 mr-2" />
                    加入生词本
                  </button>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Vocab View ---
function VocabView({ savedVocab, setSavedVocab, savedPhrases, setSavedPhrases }: { savedVocab: VocabItem[], setSavedVocab: any, savedPhrases: PhraseItem[], setSavedPhrases: any }) {
  const [typeTab, setTypeTab] = useState<'words' | 'phrases'>('words');
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all');

  const filteredVocab = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    return (savedVocab || []).filter(v => {
      if (!v.timestamp) return true;
      if (filter === 'today') return now - v.timestamp < day;
      if (filter === 'week') return now - v.timestamp < 7 * day;
      return true;
    }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [savedVocab, filter]);

  const filteredPhrases = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    return (savedPhrases || []).filter(p => {
      if (!p.timestamp) return true;
      if (filter === 'today') return now - p.timestamp < day;
      if (filter === 'week') return now - p.timestamp < 7 * day;
      return true;
    }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [savedPhrases, filter]);

  const handleDeleteVocab = (word: string) => {
    setSavedVocab((savedVocab || []).filter(v => v.word !== word));
  };

  const handleDeletePhrase = (phrase: string) => {
    setSavedPhrases((savedPhrases || []).filter(p => p.phrase !== phrase));
  };

  return (
    <div className="px-5 pt-12 pb-6 max-w-md mx-auto">
      <header className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-[#1D1D1F] dark:text-zinc-100 flex items-center mb-1"><span className="mr-2">📚</span> 我的收藏</h1>
          <p className="text-[#6E6E73] dark:text-zinc-400 text-sm">共 {typeTab === 'words' ? savedVocab?.length || 0 : savedPhrases?.length || 0} 个收藏</p>
        </div>
        <div className="flex bg-white dark:bg-zinc-900 rounded-lg p-1">
          <button 
            onClick={() => setTypeTab('words')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${typeTab === 'words' ? 'bg-zinc-100 dark:bg-zinc-800 text-white' : 'text-[#6E6E73] dark:text-zinc-500'}`}
          >
            单词
          </button>
          <button 
            onClick={() => setTypeTab('phrases')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${typeTab === 'phrases' ? 'bg-zinc-100 dark:bg-zinc-800 text-white' : 'text-[#6E6E73] dark:text-zinc-500'}`}
          >
            短语
          </button>
        </div>
      </header>

      <div className="flex space-x-2 mb-6">
        {[
          { id: 'all', label: '全部' },
          { id: 'today', label: '今天' },
          { id: 'week', label: '本周' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.id ? 'bg-indigo-500 text-white' : 'bg-white dark:bg-zinc-900 text-[#6E6E73] dark:text-zinc-400 border border-black/5 dark:border-white/5'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {typeTab === 'words' ? (
        filteredVocab && filteredVocab.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#6E6E73] dark:text-zinc-500">
            <Bookmark className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">还没有收藏生词哦，去阅读文章试试吧</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredVocab.map((item) => (
                <VocabCard key={item.word} item={item} onDelete={() => handleDeleteVocab(item.word)} />
              ))}
            </AnimatePresence>
          </div>
        )
      ) : (
        filteredPhrases && filteredPhrases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#6E6E73] dark:text-zinc-500">
            <Bookmark className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">还没有收藏短语哦，去阅读文章试试吧</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredPhrases.map((item) => (
                <PhraseCard key={item.phrase} item={item} onDelete={() => handleDeletePhrase(item.phrase)} />
              ))}
            </AnimatePresence>
          </div>
        )
      )}
    </div>
  );
}

// --- Vocab & Phrase Cards ---
function VocabCard({ item, onDelete }: { item: VocabItem, onDelete: () => void, key?: React.Key }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const currentDef = item.definitions?.find(d => d.id === item.contextIndex);
  const chineseMeaning = currentDef?.meaningCn || currentDef?.meaning || item.meaning || '';
  const englishMeaning = currentDef?.meaning || item.definitions?.[0]?.meaning || '';

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-white/60 dark:bg-zinc-900/60 border border-black/5 dark:border-white/5 rounded-2xl shadow-sm p-5 relative overflow-hidden group text-[#1D1D1F] dark:text-zinc-200"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3 pr-8">
        <div>
          <h3 className="text-xl font-bold text-[#1D1D1F] dark:text-zinc-100 tracking-tight">{item.lemma || item.word}</h3>
          <span className="text-sm text-[#6E6E73] dark:text-zinc-500 font-mono mt-0.5 block">{item.phonetic}</span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-4 right-4 text-[#6E6E73] dark:text-zinc-500 hover:text-red-400 transition-colors p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Core */}
      <div className="mb-4">
        <div className="flex items-baseline space-x-2 mb-1">
          <span className="text-xs font-bold text-blue-500 bg-blue-50 dark:text-indigo-300 dark:bg-indigo-500/20 px-1.5 py-0.5 rounded">{item.partOfSpeech}</span>
          <span className="text-base font-bold text-blue-600 dark:text-indigo-200">{chineseMeaning}</span>
        </div>
        {englishMeaning && (
          <div className="text-sm text-[#6E6E73] dark:text-zinc-400 leading-snug">{englishMeaning}</div>
        )}
      </div>

      {/* Contexts */}
      <div className="mb-4 space-y-3">
        {item.sourceText && (
          <div>
            {item.contexts && item.contexts.length > 0 && (
              <div className="text-xs font-bold text-[#6E6E73] dark:text-zinc-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>语境 1</span>
                <span className="text-blue-600 dark:text-indigo-300 normal-case">{chineseMeaning}</span>
              </div>
            )}
            <div className="text-sm text-[#6E6E73] dark:text-zinc-400 italic border-l-2 border-blue-300 dark:border-indigo-500/50 pl-3 py-0.5">
              "{item.sourceText}"
            </div>
          </div>
        )}
        {item.contexts?.map((ctx, idx) => (
          <div key={idx}>
            <div className="text-xs font-bold text-[#6E6E73] dark:text-zinc-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>语境 {idx + 2}</span>
              <span className="text-blue-600 dark:text-indigo-300 normal-case">{ctx.meaning}</span>
            </div>
            <div className="text-sm text-[#6E6E73] dark:text-zinc-400 italic border-l-2 border-blue-300 dark:border-indigo-500/50 pl-3 py-0.5">
              "{ctx.sourceText}"
            </div>
          </div>
        ))}
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-4">
              {/* Collocations */}
              {item.collocations && item.collocations.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-[#6E6E73] dark:text-zinc-500 uppercase tracking-wider mb-2">常见搭配</div>
                  <ul className="space-y-1.5">
                    {item.collocations.map((col, idx) => {
                      if (typeof col === 'string') {
                        return <li key={idx} className="text-sm text-[#1D1D1F] dark:text-zinc-300 flex items-start"><span className="mr-1.5 text-indigo-400">•</span>{col}</li>;
                      }
                      return (
                        <li key={idx} className="text-sm text-[#1D1D1F] dark:text-zinc-300 flex items-start">
                          <span className="mr-1.5 text-indigo-400">•</span>
                          <span>{col.en} <span className="text-[#6E6E73] dark:text-zinc-500 text-xs ml-1">{col.cn}</span></span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* More Examples */}
              {(item.exampleEn || item.definitions?.[0]?.scenario) && (
                <div>
                  <div className="text-xs font-bold text-[#6E6E73] dark:text-zinc-500 uppercase tracking-wider mb-2">更多例句</div>
                  <div className="bg-[#F5F5F7]/50 dark:bg-zinc-950/50 rounded-lg p-3 border border-black/5 dark:border-white/5">
                    <div className="text-sm text-[#1D1D1F] dark:text-zinc-300 mb-1">{item.exampleEn || item.definitions?.[0]?.scenario}</div>
                    <div className="text-xs text-[#6E6E73] dark:text-zinc-500">{item.exampleCn || item.definitions?.[0]?.scenarioCn}</div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full mt-2 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-center text-xs font-medium text-[#6E6E73] dark:text-zinc-500 hover:text-[#1D1D1F] dark:text-zinc-300 transition-colors"
      >
        {isExpanded ? (
          <>收起详情 <ChevronUp className="w-3 h-3 ml-1" /></>
        ) : (
          <>展开详情 <ChevronDown className="w-3 h-3 ml-1" /></>
        )}
      </button>
    </motion.div>
  );
}

function PhraseCard({ item, onDelete }: { item: PhraseItem, onDelete: () => void, key?: React.Key }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-white/60 dark:bg-zinc-900/60 border border-black/5 dark:border-white/5 rounded-2xl shadow-sm p-5 relative overflow-hidden group text-[#1D1D1F] dark:text-zinc-200"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3 pr-8">
        <div>
          <h3 className="text-xl font-bold text-[#1D1D1F] dark:text-zinc-100 tracking-tight mb-1">{item.phrase}</h3>
          {item.contextTags && item.contextTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.contextTags.map((tag, idx) => (
                <span key={idx} className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-4 right-4 text-[#6E6E73] dark:text-zinc-500 hover:text-red-400 transition-colors p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Core */}
      <div className="mb-4 space-y-2">
        <div className="flex items-start">
          <span className="text-xs font-bold text-[#6E6E73] dark:text-zinc-500 w-16 shrink-0 mt-0.5">语境义</span>
          <div className="flex flex-col">
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-200">{item.contextMeaningCn || item.meaning}</span>
            {item.contextMeaningEn && <span className="text-sm text-[#6E6E73] dark:text-zinc-400 mt-0.5">{item.contextMeaningEn}</span>}
          </div>
        </div>
        {(item.commonMeaningCn || item.literalMeaning) && (
          <div className="flex items-start">
            <span className="text-xs font-bold text-[#6E6E73] dark:text-zinc-500 w-16 shrink-0 mt-0.5">常见释义</span>
            <div className="flex flex-col">
              <span className="text-sm text-[#1D1D1F] dark:text-zinc-300">{item.commonMeaningCn || item.literalMeaning}</span>
              {item.commonMeaningEn && <span className="text-sm text-[#6E6E73] dark:text-zinc-400 mt-0.5">{item.commonMeaningEn}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Contexts */}
      <div className="mb-4 space-y-3">
        {item.sourceText && (
          <div>
            {item.contexts && item.contexts.length > 0 && (
              <div className="text-xs font-bold text-[#6E6E73] dark:text-zinc-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>语境 1</span>
                <span className="text-emerald-600 dark:text-emerald-300 normal-case">{item.contextMeaningCn || item.meaning}</span>
              </div>
            )}
            <div className="text-sm text-[#6E6E73] dark:text-zinc-400 italic border-l-2 border-blue-300 dark:border-emerald-500/50 pl-3 py-0.5">
              "{item.sourceText}"
            </div>
          </div>
        )}
        {item.contexts?.map((ctx, idx) => (
          <div key={idx}>
            <div className="text-xs font-bold text-[#6E6E73] dark:text-zinc-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>语境 {idx + 2}</span>
              <span className="text-emerald-600 dark:text-emerald-300 normal-case">{ctx.meaning}</span>
            </div>
            <div className="text-sm text-[#6E6E73] dark:text-zinc-400 italic border-l-2 border-blue-300 dark:border-emerald-500/50 pl-3 py-0.5">
              "{ctx.sourceText}"
            </div>
          </div>
        ))}
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-4">
              {/* Synonyms / Paraphrase */}
              {item.synonyms && item.synonyms.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-[#6E6E73] dark:text-zinc-500 uppercase tracking-wider mb-2">同义替换 (Paraphrase)</div>
                  <div className="grid grid-cols-1 gap-2">
                    {item.synonyms.map((syn, idx) => (
                      <div key={idx} className="bg-[#F5F5F7]/50 dark:bg-zinc-950/50 border border-black/5 dark:border-white/5 rounded-lg p-2.5 flex items-center justify-between">
                        <span className="text-sm font-medium text-[#1D1D1F] dark:text-zinc-300">{syn.word}</span>
                        <span className="text-xs text-[#6E6E73] dark:text-zinc-500">{syn.meaning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full mt-2 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-center text-xs font-medium text-[#6E6E73] dark:text-zinc-500 hover:text-[#1D1D1F] dark:text-zinc-300 transition-colors"
      >
        {isExpanded ? (
          <>收起详情 <ChevronUp className="w-3 h-3 ml-1" /></>
        ) : (
          <>展开详情 <ChevronDown className="w-3 h-3 ml-1" /></>
        )}
      </button>
    </motion.div>
  );
}

// --- Profile View ---
function ProfileView({ level, setLevel, stats, savedCount, setSavedVocab, setSavedPhrases, setStats, isDarkMode, setIsDarkMode }: any) {
  const handleClear = () => {
    if (window.confirm('确定要清除所有学习数据和生词本吗？此操作不可恢复。')) {
      setSavedVocab([]);
      setSavedPhrases([]);
      setStats({ learnedCount: 0 });
      setLevel('四级');
    }
  };

  return (
    <div className="px-5 pt-12 pb-6 max-w-md mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-[#1D1D1F] dark:text-zinc-100 flex items-center"><span className="mr-2">👤</span> 我的</h1>
      </header>
      
      <div className="space-y-6">
        <section>
          <h2 className="text-xs font-semibold text-[#6E6E73] dark:text-zinc-500 uppercase tracking-wider mb-3">学习统计</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/60 dark:bg-zinc-900/60 rounded-2xl p-4 border border-black/5 dark:border-white/5 transition-colors duration-300">
              <div className="text-[#6E6E73] dark:text-zinc-400 text-xs mb-1">累计学习</div>
              <div className="text-2xl font-bold text-indigo-400">{stats.learnedCount} <span className="text-sm font-normal text-[#6E6E73] dark:text-zinc-500">次</span></div>
            </div>
            <div className="bg-white/60 dark:bg-zinc-900/60 rounded-2xl p-4 border border-black/5 dark:border-white/5 transition-colors duration-300">
              <div className="text-[#6E6E73] dark:text-zinc-400 text-xs mb-1">收藏生词</div>
              <div className="text-2xl font-bold text-purple-400">{savedCount} <span className="text-sm font-normal text-[#6E6E73] dark:text-zinc-500">个</span></div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-[#6E6E73] dark:text-zinc-500 uppercase tracking-wider mb-3">设置</h2>
          <div className="bg-white/60 dark:bg-zinc-900/60 rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden transition-colors duration-300">
            <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
              <span className="text-[#1D1D1F] dark:text-zinc-300 text-sm">当前词汇量等级</span>
              <select 
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="bg-zinc-100 dark:bg-zinc-800 text-indigo-300 text-sm rounded-lg px-2 py-1 outline-none border border-black/5 dark:border-white/5"
              >
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
              <span className="text-[#1D1D1F] dark:text-zinc-300 text-sm">外观模式</span>
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${isDarkMode ? 'bg-indigo-500' : 'bg-zinc-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <button 
              onClick={handleClear}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-100/50 dark:bg-zinc-800/50 transition-colors active:bg-zinc-100 dark:bg-zinc-800"
            >
              <span className="text-red-400 text-sm">清除所有数据</span>
              <Trash2 className="w-4 h-4 text-red-400/50" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
