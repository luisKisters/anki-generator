import { useState } from "react";
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

type CardType = "basic" | "cloze";
type AppState = "initial" | "generated" | "downloaded";
type Card = {
  front?: string;
  back?: string;
  text?: string;
};

type TemperatureStage = {
  name: string;
  description: string;
  color: string;
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

const panelVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 20,
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const cardSlideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 30,
    },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 100 : -100,
    opacity: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 30,
    },
  }),
};

const buttonGroupVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.15,
    },
  },
};

const getTemperatureStage = (temp: number): TemperatureStage => {
  if (temp <= 0.2) {
    return {
      name: "Precise",
      description: "Factual, consistent output",
      color: "text-cyan-400",
    };
  } else if (temp <= 0.5) {
    return {
      name: "Balanced",
      description: "Recommended setting",
      color: "text-emerald-400",
    };
  } else if (temp <= 0.8) {
    return {
      name: "Creative",
      description: "More variety",
      color: "text-amber-400",
    };
  } else {
    return {
      name: "Wild",
      description: "Experimental",
      color: "text-red-400",
    };
  }
};

function App() {
  // Core state
  const [cardType, setCardType] = useState<CardType>("basic");
  const [inputText, setInputText] = useState("");
  const [suggestedChanges, setSuggestedChanges] = useState("");
  const [generatedCards, setGeneratedCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [appState, setAppState] = useState<AppState>("initial");
  const [slideDirection, setSlideDirection] = useState(0);

  // Card count state
  const [cardCountInput, setCardCountInput] = useState<number>(5);
  const [autoCardCount, setAutoCardCount] = useState(false);

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("geminiApiKey") || ""
  );
  const [temperature, setTemperature] = useState(() => {
    const saved = localStorage.getItem("temperature");
    return saved ? parseFloat(saved) : 0.3;
  });

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveApiKey = (key: string) => {
    localStorage.setItem("geminiApiKey", key);
    setApiKey(key);
    setShowSettings(false);
  };

  const handleTemperatureChange = (value: number) => {
    setTemperature(value);
    localStorage.setItem("temperature", value.toString());
  };

  const generatePrompt = (text: string, type: CardType, changes?: string) => {
    const countInstruction = autoCardCount
      ? "Determine the optimal number of cards based on the content density and complexity. Aim for comprehensive coverage without redundancy (typically 3-20 cards depending on content)."
      : `Create exactly ${cardCountInput} cards.`;

    const cardTypeInstructions =
      type === "basic"
        ? `Card Format (Basic):
- "front": A clear, specific question that tests one concept
- "back": A concise, accurate answer
- Example: {"front": "What is the <b>capital</b> of France?", "back": "<b>Paris</b> - located on the Seine River"}`
        : `Card Format (Cloze Deletion):
- "text": A complete sentence with {{c1::hidden term}} syntax
- Include context clues and hints in parentheses when helpful
- Example: {"text": "The {{c1::<b>mitochondria</b>}} is the powerhouse of the cell, responsible for {{c2::ATP production}}."}`;

    const modificationsSection = changes
      ? `
IMPORTANT - User Modifications Requested:
${changes}
Apply these modifications while maintaining card quality. This may involve:
- Adjusting difficulty level
- Focusing on specific topics or concepts
- Changing the style or format of questions
- Adding more context or examples
`
      : "";

    const systemPrompt = `You are an expert educational content creator specializing in spaced repetition flashcards for Anki.

TASK: Generate high-quality flashcards from the provided source material.
${modificationsSection}
OUTPUT FORMAT:
Return ONLY valid JSON with no additional text, explanations, or markdown code blocks.

{
  "cards": [
    ${type === "basic" ? '{"front": "...", "back": "..."}' : '{"text": "..."}'}
  ]
}

${cardTypeInstructions}

CARD GENERATION RULES:
1. ${countInstruction}
2. Language: Match the language of the source material exactly
3. Quality Standards:
   - Each card should test ONE specific concept
   - Avoid vague or overly broad questions
   - Include enough context to understand the question
   - Answers should be accurate and verifiable from the source
4. HTML Formatting (use sparingly):
   - <b>bold</b> for key terms and important concepts
   - <i>italic</i> for hints, translations, or secondary information
   - Avoid excessive formatting
5. Content Guidelines:
   - Prioritize the most important and testable information
   - Create cards that promote understanding, not just memorization
   - For technical content, include practical examples when possible
   - Avoid redundant cards that test the same concept differently

SOURCE MATERIAL:
${text}`;

    return systemPrompt;
  };

  const handleGenerate = async (isApplyChanges = false) => {
    if (!apiKey) {
      setError("Please set your Gemini API key in settings first");
      setShowSettings(true);
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = generatePrompt(
        inputText,
        cardType,
        isApplyChanges ? suggestedChanges : undefined
      );

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          temperature: temperature,
        },
      });
      const response = result.text ?? "";

      const jsonMatch =
        response.match(/```json\n([\s\S]*)\n```/) ||
        response.match(/```([\s\S]*)```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response;

      try {
        const data = JSON.parse(jsonStr.trim());
        if (!data.cards || !Array.isArray(data.cards)) {
          throw new Error("Invalid response format");
        }
        setGeneratedCards(data.cards);
        setCurrentCardIndex(0);
        setAppState("generated");
      } catch {
        console.error("Raw response:", response);
        throw new Error("Failed to parse AI response");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate cards");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadCSV = () => {
    let csv = "";
    if (cardType === "basic") {
      csv =
        "front,back\n" +
        generatedCards
          .map((card) => `"${card.front}","${card.back}"`)
          .join("\n");
    } else {
      csv =
        "text\n" + generatedCards.map((card) => `"${card.text}"`).join("\n");
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anki-cards.csv";
    a.click();
    setAppState("downloaded");
  };

  const handleRestart = () => {
    setGeneratedCards([]);
    setCurrentCardIndex(0);
    setAppState("initial");
    setInputText("");
    setSuggestedChanges("");
    setError(null);
  };

  const navigateCard = (direction: number) => {
    setSlideDirection(direction);
    setCurrentCardIndex((prev) => {
      if (direction > 0) {
        return Math.min(generatedCards.length - 1, prev + 1);
      } else {
        return Math.max(0, prev - 1);
      }
    });
  };

  const currentCard = generatedCards[currentCardIndex];

  return (
    <div className="min-h-screen bg-void bg-grid-pattern">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="border-b border-primary/30 bg-void-light/80 backdrop-blur-sm"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <motion.div
              animate={{
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3,
              }}
            >
              <Zap className="w-8 h-8 text-primary-bright" />
            </motion.div>
            <h1 className="header-title">Anki Generator</h1>
          </motion.div>
          <motion.div
            className="flex items-center gap-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <span className="status-indicator active">
              <span className="mono text-xs">SYSTEM ONLINE</span>
            </span>
            <motion.button
              onClick={() => setShowSettings(true)}
              className="p-2 text-text-muted hover:text-primary-bright transition-colors"
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.95 }}
            >
              <Settings className="w-5 h-5" />
            </motion.button>
          </motion.div>
        </div>
      </motion.header>

      {/* Main Content - Two Panel Layout */}
      <main className="max-w-7xl mx-auto p-6 h-[calc(100vh-73px)]">
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Left Panel - Controls */}
          <motion.div
            className="panel p-6 flex flex-col corner-brackets"
            variants={panelVariants}
          >
            <motion.div
              className="flex items-center justify-between mb-6"
              variants={itemVariants}
            >
              <h2 className="text-lg font-semibold text-text uppercase tracking-wider">
                Configuration
              </h2>
              <span className="mono text-xs text-text-dim">CTRL_PANEL</span>
            </motion.div>

            {/* Card Type Selection */}
            <motion.div className="mb-6" variants={itemVariants}>
              <label className="label">Card Type</label>
              <div className="grid grid-cols-2 gap-3">
                {(["basic", "cloze"] as const).map((type) => (
                  <motion.button
                    key={type}
                    onClick={() => setCardType(type)}
                    className={`p-4 rounded border transition-colors ${
                      cardType === type
                        ? "border-primary bg-primary/20 text-primary-bright"
                        : "border-border bg-void hover:border-primary/50 text-text-muted"
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="block font-semibold capitalize">
                      {type}
                    </span>
                    <span className="text-xs opacity-70">
                      {type === "basic" ? "Front / Back" : "Fill in blank"}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Card Count */}
            <motion.div className="mb-6" variants={itemVariants}>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Card Amount</label>
                <motion.button
                  onClick={() => setAutoCardCount(!autoCardCount)}
                  className={`flex items-center gap-2 text-xs uppercase tracking-wider transition-colors ${
                    autoCardCount ? "text-accent" : "text-text-muted"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Auto</span>
                  <div
                    className={`toggle-switch ${autoCardCount ? "active" : ""}`}
                  />
                </motion.button>
              </div>

              <AnimatePresence mode="wait">
                {!autoCardCount ? (
                  <motion.div
                    key="manual"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-4"
                  >
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={cardCountInput}
                      onChange={(e) =>
                        setCardCountInput(parseInt(e.target.value))
                      }
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={cardCountInput}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val >= 1 && val <= 50) {
                          setCardCountInput(val);
                        }
                      }}
                      className="input-field w-20 text-center"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="auto"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 bg-accent/10 border border-accent/30 rounded text-accent text-sm"
                  >
                    <Sparkles className="w-4 h-4 inline mr-2" />
                    AI will determine optimal card count
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Temperature */}
            <motion.div className="mb-6" variants={itemVariants}>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Creativity</label>
                <motion.span
                  key={getTemperatureStage(temperature).name}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mono text-xs ${
                    getTemperatureStage(temperature).color
                  }`}
                >
                  {getTemperatureStage(temperature).name}
                </motion.span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) =>
                  handleTemperatureChange(parseFloat(e.target.value))
                }
                className="w-full"
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-text-dim">Precise</span>
                <span className="text-xs text-text-dim">Wild</span>
              </div>
            </motion.div>

            {/* Input Text */}
            <motion.div
              className="flex-1 flex flex-col mb-6"
              variants={itemVariants}
            >
              <label className="label">Source Material</label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your text here..."
                className="input-field flex-1 resize-none min-h-[120px]"
              />
            </motion.div>

            {/* Suggested Changes (visible after generation) */}
            <AnimatePresence>
              {appState !== "initial" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 overflow-hidden"
                >
                  <label className="label">Suggest Changes</label>
                  <textarea
                    value={suggestedChanges}
                    onChange={(e) => setSuggestedChanges(e.target.value)}
                    placeholder="E.g., 'Make questions harder' or 'Focus on dates'"
                    className="input-field w-full h-20 resize-none"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Display */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="mt-auto">
              <AnimatePresence mode="wait">
                {appState === "initial" ? (
                  <motion.button
                    key="generate"
                    variants={buttonGroupVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onClick={() => handleGenerate(false)}
                    disabled={isGenerating || !inputText.trim()}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isGenerating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    <span>{isGenerating ? "Generating..." : "Generate"}</span>
                  </motion.button>
                ) : (
                  <motion.div
                    key="actions"
                    variants={buttonGroupVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="grid grid-cols-2 gap-3"
                  >
                    <motion.button
                      onClick={() => handleGenerate(true)}
                      disabled={isGenerating}
                      className="btn-primary flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isGenerating ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Sparkles className="w-5 h-5" />
                      )}
                      <span>Apply</span>
                    </motion.button>
                    <motion.button
                      onClick={handleRestart}
                      className="btn-secondary flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <RefreshCw className="w-5 h-5" />
                      <span>Restart</span>
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Right Panel - Preview */}
          <motion.div
            className="panel p-6 flex flex-col corner-brackets"
            variants={panelVariants}
          >
            <motion.div
              className="flex items-center justify-between mb-6"
              variants={itemVariants}
            >
              <h2 className="text-lg font-semibold text-text uppercase tracking-wider">
                Card Preview
              </h2>
              <motion.span
                key={`${currentCardIndex}-${generatedCards.length}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mono text-xs text-text-dim"
              >
                {generatedCards.length > 0
                  ? `${currentCardIndex + 1}/${generatedCards.length}`
                  : "NO_DATA"}
              </motion.span>
            </motion.div>

            {/* Card Display */}
            <motion.div
              className="flex-1 flex flex-col"
              variants={itemVariants}
            >
              <AnimatePresence mode="wait">
                {generatedCards.length > 0 && currentCard ? (
                  <motion.div
                    key="cards"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col"
                  >
                    {/* Card Content */}
                    <div className="card-preview flex-1 p-6 scan-lines overflow-hidden relative">
                      <AnimatePresence mode="wait" custom={slideDirection}>
                        <motion.div
                          key={currentCardIndex}
                          custom={slideDirection}
                          variants={cardSlideVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          className="h-full"
                        >
                          {cardType === "basic" ? (
                            <div className="space-y-6 h-full flex flex-col">
                              <div className="flex-1">
                                <div className="label text-accent">Front</div>
                                <div
                                  className="text-lg text-text leading-relaxed"
                                  dangerouslySetInnerHTML={{
                                    __html: currentCard.front || "",
                                  }}
                                />
                              </div>
                              <div className="divider" />
                              <div className="flex-1">
                                <div className="label text-primary-bright">
                                  Back
                                </div>
                                <div
                                  className="text-lg text-text leading-relaxed"
                                  dangerouslySetInnerHTML={{
                                    __html: currentCard.back || "",
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="label text-accent">Cloze</div>
                              <div
                                className="text-lg text-text leading-relaxed"
                                dangerouslySetInnerHTML={{
                                  __html: currentCard.text || "",
                                }}
                              />
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-4">
                      <motion.button
                        onClick={() => navigateCard(-1)}
                        disabled={currentCardIndex === 0}
                        className="btn-secondary px-4 py-2 flex items-center gap-2 disabled:opacity-30"
                        whileHover={{ scale: 1.05, x: -2 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="hidden sm:inline">Prev</span>
                      </motion.button>

                      <div className="flex gap-1">
                        {generatedCards.map((_, idx) => (
                          <motion.button
                            key={idx}
                            onClick={() => {
                              setSlideDirection(idx > currentCardIndex ? 1 : -1);
                              setCurrentCardIndex(idx);
                            }}
                            className={`h-2 rounded-full transition-colors ${
                              idx === currentCardIndex
                                ? "bg-primary-bright"
                                : "bg-surface-light hover:bg-primary/50"
                            }`}
                            animate={{
                              width: idx === currentCardIndex ? 24 : 8,
                            }}
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                          />
                        ))}
                      </div>

                      <motion.button
                        onClick={() => navigateCard(1)}
                        disabled={
                          currentCardIndex === generatedCards.length - 1
                        }
                        className="btn-secondary px-4 py-2 flex items-center gap-2 disabled:opacity-30"
                        whileHover={{ scale: 1.05, x: 2 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight className="w-5 h-5" />
                      </motion.button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex items-center justify-center"
                  >
                    <div className="text-center text-text-dim">
                      <motion.div
                        className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-dashed border-border flex items-center justify-center"
                        animate={{
                          borderColor: [
                            "rgba(124, 58, 237, 0.3)",
                            "rgba(124, 58, 237, 0.6)",
                            "rgba(124, 58, 237, 0.3)",
                          ],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        <Zap className="w-8 h-8 opacity-30" />
                      </motion.div>
                      <p className="mono text-sm">AWAITING INPUT</p>
                      <p className="text-xs mt-2 opacity-50">
                        Generate cards to preview
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Download Button */}
            <motion.div className="mt-6" variants={itemVariants}>
              <AnimatePresence mode="wait">
                {appState === "initial" ? (
                  <motion.button
                    key="disabled"
                    variants={buttonGroupVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    disabled
                    className="btn-accent w-full flex items-center justify-center gap-2 opacity-30 cursor-not-allowed"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download CSV</span>
                  </motion.button>
                ) : appState === "generated" ? (
                  <motion.button
                    key="download"
                    variants={buttonGroupVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onClick={downloadCSV}
                    className="btn-accent w-full flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Download className="w-5 h-5" />
                    <span>Download CSV</span>
                  </motion.button>
                ) : (
                  <motion.div
                    key="downloaded"
                    variants={buttonGroupVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="grid grid-cols-2 gap-3"
                  >
                    <motion.button
                      onClick={downloadCSV}
                      className="btn-accent flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Download className="w-5 h-5" />
                      <span>Again</span>
                    </motion.button>
                    <motion.button
                      onClick={handleRestart}
                      className="btn-secondary flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <RefreshCw className="w-5 h-5" />
                      <span>Restart</span>
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </motion.div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="panel p-6 max-w-md w-full corner-brackets"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold uppercase tracking-wider">
                  Settings
                </h2>
                <motion.button
                  onClick={() => setShowSettings(false)}
                  className="text-text-muted hover:text-text transition-colors"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              <motion.div
                className="mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <label className="label">Gemini API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="input-field w-full"
                  placeholder="Enter your API key"
                />
                <p className="mt-2 text-sm text-text-dim">
                  Get your API key from{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-bright hover:underline"
                  >
                    Google AI Studio
                  </a>
                </p>
              </motion.div>

              <motion.button
                onClick={() => saveApiKey(apiKey)}
                className="btn-primary w-full"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                Save Settings
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/50 backdrop-blur-sm flex items-center justify-center z-40 pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 mx-auto mb-4 border-4 border-primary/30 border-t-primary-bright rounded-full"
              />
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="mono text-primary-bright text-sm uppercase tracking-wider"
              >
                Processing...
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
