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
    const count = autoCardCount ? "an appropriate number of" : cardCountInput;
    const changesSection = changes
      ? `\n\nUser requested modifications:\n${changes}`
      : "";

    const basePrompt = `You are an expert flashcard generator. Create ${count} high-quality Anki flashcards from the provided text.${changesSection}

Output ONLY valid JSON in this exact format:
{
  "cards": [
    ${
      type === "basic"
        ? '{"front": "Question with <b>key terms</b> highlighted?", "back": "<b>Answer</b> with important details"}'
        : '{"text": "Example sentence with {{c1::<b>cloze deletion</b>}} for key concept"}'
    }
  ]
}

Guidelines:
1. Output ONLY valid JSON - no explanations or markdown
2. ${autoCardCount ? "Create a realistic number of cards based on content density (typically 3-15)" : `Create exactly ${cardCountInput} cards`}
3. Match the language of the input text
4. Focus on practical, memorable content
5. ${
      type === "basic"
        ? "Make questions specific and answers concise"
        : "Use {{c1::term}} syntax for cloze deletions, include context"
    }
6. Use HTML formatting sparingly: <b>bold</b> for key terms, <i>italic</i> for hints

Input text:
${text}`;

    return basePrompt;
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

  const currentCard = generatedCards[currentCardIndex];

  return (
    <div className="min-h-screen bg-void bg-grid-pattern">
      {/* Header */}
      <header className="border-b border-primary/30 bg-void-light/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-primary-bright" />
            <h1 className="header-title">Anki Generator</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="status-indicator active">
              <span className="mono text-xs">SYSTEM ONLINE</span>
            </span>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-text-muted hover:text-primary-bright transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Two Panel Layout */}
      <main className="max-w-7xl mx-auto p-6 h-[calc(100vh-73px)]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          {/* Left Panel - Controls */}
          <div className="panel p-6 flex flex-col corner-brackets">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-text uppercase tracking-wider">
                Configuration
              </h2>
              <span className="mono text-xs text-text-dim">CTRL_PANEL</span>
            </div>

            {/* Card Type Selection */}
            <div className="mb-6">
              <label className="label">Card Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setCardType("basic")}
                  className={`p-4 rounded border transition-all ${
                    cardType === "basic"
                      ? "border-primary bg-primary/20 text-primary-bright"
                      : "border-border bg-void hover:border-primary/50 text-text-muted"
                  }`}
                >
                  <span className="block font-semibold">Basic</span>
                  <span className="text-xs opacity-70">Front / Back</span>
                </button>
                <button
                  onClick={() => setCardType("cloze")}
                  className={`p-4 rounded border transition-all ${
                    cardType === "cloze"
                      ? "border-primary bg-primary/20 text-primary-bright"
                      : "border-border bg-void hover:border-primary/50 text-text-muted"
                  }`}
                >
                  <span className="block font-semibold">Cloze</span>
                  <span className="text-xs opacity-70">Fill in blank</span>
                </button>
              </div>
            </div>

            {/* Card Count */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Card Amount</label>
                <button
                  onClick={() => setAutoCardCount(!autoCardCount)}
                  className={`flex items-center gap-2 text-xs uppercase tracking-wider transition-colors ${
                    autoCardCount ? "text-accent" : "text-text-muted"
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Auto</span>
                  <div
                    className={`toggle-switch ${autoCardCount ? "active" : ""}`}
                  />
                </button>
              </div>

              {!autoCardCount ? (
                <div className="flex items-center gap-4">
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
                </div>
              ) : (
                <div className="p-3 bg-accent/10 border border-accent/30 rounded text-accent text-sm">
                  <Sparkles className="w-4 h-4 inline mr-2" />
                  AI will determine optimal card count
                </div>
              )}
            </div>

            {/* Temperature */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Creativity</label>
                <span
                  className={`mono text-xs ${
                    getTemperatureStage(temperature).color
                  }`}
                >
                  {getTemperatureStage(temperature).name}
                </span>
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
            </div>

            {/* Input Text */}
            <div className="flex-1 flex flex-col mb-6">
              <label className="label">Source Material</label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your text here..."
                className="input-field flex-1 resize-none min-h-[120px]"
              />
            </div>

            {/* Suggested Changes (visible after generation) */}
            {appState !== "initial" && (
              <div className="mb-6">
                <label className="label">Suggest Changes</label>
                <textarea
                  value={suggestedChanges}
                  onChange={(e) => setSuggestedChanges(e.target.value)}
                  placeholder="E.g., 'Make questions harder' or 'Focus on dates'"
                  className="input-field w-full h-20 resize-none"
                />
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-auto">
              {appState === "initial" ? (
                <button
                  onClick={() => handleGenerate(false)}
                  disabled={isGenerating || !inputText.trim()}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  <span>{isGenerating ? "Generating..." : "Generate"}</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleGenerate(true)}
                    disabled={isGenerating}
                    className="btn-primary flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                    <span>Apply</span>
                  </button>
                  <button
                    onClick={handleRestart}
                    className="btn-secondary flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span>Restart</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="panel p-6 flex flex-col corner-brackets">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-text uppercase tracking-wider">
                Card Preview
              </h2>
              <span className="mono text-xs text-text-dim">
                {generatedCards.length > 0
                  ? `${currentCardIndex + 1}/${generatedCards.length}`
                  : "NO_DATA"}
              </span>
            </div>

            {/* Card Display */}
            <div className="flex-1 flex flex-col">
              {generatedCards.length > 0 && currentCard ? (
                <div className="flex-1 flex flex-col">
                  {/* Card Content */}
                  <div className="card-preview flex-1 p-6 scan-lines">
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
                          <div className="label text-primary-bright">Back</div>
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
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between mt-4">
                    <button
                      onClick={() =>
                        setCurrentCardIndex((prev) => Math.max(0, prev - 1))
                      }
                      disabled={currentCardIndex === 0}
                      className="btn-secondary px-4 py-2 flex items-center gap-2 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      <span className="hidden sm:inline">Prev</span>
                    </button>

                    <div className="flex gap-1">
                      {generatedCards.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentCardIndex(idx)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            idx === currentCardIndex
                              ? "bg-primary-bright w-6"
                              : "bg-surface-light hover:bg-primary/50"
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={() =>
                        setCurrentCardIndex((prev) =>
                          Math.min(generatedCards.length - 1, prev + 1)
                        )
                      }
                      disabled={currentCardIndex === generatedCards.length - 1}
                      className="btn-secondary px-4 py-2 flex items-center gap-2 disabled:opacity-30"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-text-dim">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                      <Zap className="w-8 h-8 opacity-30" />
                    </div>
                    <p className="mono text-sm">AWAITING INPUT</p>
                    <p className="text-xs mt-2 opacity-50">
                      Generate cards to preview
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Download Button */}
            <div className="mt-6">
              {appState === "initial" ? (
                <button
                  disabled
                  className="btn-accent w-full flex items-center justify-center gap-2 opacity-30 cursor-not-allowed"
                >
                  <Download className="w-5 h-5" />
                  <span>Download CSV</span>
                </button>
              ) : appState === "generated" ? (
                <button
                  onClick={downloadCSV}
                  className="btn-accent w-full flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  <span>Download CSV</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={downloadCSV}
                    className="btn-accent flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    <span>Again</span>
                  </button>
                  <button
                    onClick={handleRestart}
                    className="btn-secondary flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span>Restart</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="panel p-6 max-w-md w-full corner-brackets"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold uppercase tracking-wider">
                  Settings
                </h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-text-muted hover:text-text transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
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
              </div>

              <button
                onClick={() => saveApiKey(apiKey)}
                className="btn-primary w-full"
              >
                Save Settings
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
