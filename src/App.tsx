import React from "react";
import { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  BookOpen,
  BrainCircuit,
  Download,
  Eye,
  FileDown,
  Loader2,
  Settings,
  SplitSquareHorizontal,
  Square,
  X,
} from "lucide-react";

type CardType = "basic" | "cloze";
type Card = {
  front?: string;
  back?: string;
  text?: string;
};

function App() {
  const [cardType, setCardType] = useState<CardType>("basic");
  const [inputText, setInputText] = useState("");
  const [cardCountInput, setCardCountInput] = useState<string>("3");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("geminiApiKey") || ""
  );
  const [error, setError] = useState<string | null>(null);

  const saveApiKey = (key: string) => {
    localStorage.setItem("geminiApiKey", key);
    setApiKey(key);
    setShowSettings(false);
  };

  const extractCount = (text: string): [string, number] => {
    const match = text.match(/(\d+)x\s*$/);
    if (match) {
      const count = parseInt(match[1]);
      const cleanText = text.replace(/\s*\d+x\s*$/, "").trim();
      return [cleanText, count];
    }
    return [text, 3]; // Default to 3 cards if no count specified
  };

  const generatePrompt = (text: string, type: CardType) => {
    const count = parseInt(cardCountInput) || 3;

    const basePrompt = `You are a flashcard generator that ONLY outputs valid JSON. Create ${count} flashcards from this text.

The output must be in this exact JSON format, with no additional text:
{
  "cards": [
    ${
      type === "basic"
        ? '{"front": "What is the capital of France?", "back": "Paris"}'
        : '{"text": "Ayer {{c1::fui}} al cine. (ir)"}'
    }
  ]
}

Rules:
1. Output ONLY valid JSON, nothing else
2. Create exactly ${count} cards
3. Use the same language as the input text
4. Create practical examples, not theory
5. ${
      type === "basic"
        ? "Make questions clear and answers concise"
        : "For conjugation cards:\n   - Use {{c1::term}} for cloze deletions\n   - Always include infinitive in parentheses\n   - Focus on actual usage examples"
    }

Input text: ${text}`;

    return basePrompt;
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      setError("Please set your Gemini API key in settings first");
      setShowSettings(true);
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-001",
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      });

      const prompt = generatePrompt(inputText, cardType);
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      const response = result.response.text();

      try {
        const data = JSON.parse(response.trim());
        if (!data.cards || !Array.isArray(data.cards)) {
          throw new Error("Invalid response format");
        }
        setGeneratedCards(data.cards);
      } catch (e) {
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <BrainCircuit className="w-12 h-12 text-indigo-600" />
              <button
                onClick={() => setShowSettings(true)}
                className="absolute top-4 right-4 p-2 text-gray-600 hover:text-indigo-600 transition-colors"
                title="Settings"
              >
                <Settings className="w-6 h-6" />
              </button>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              AI Flashcard Generator
            </h1>
            <p className="text-lg text-gray-600">
              Transform any text into Anki flashcards with AI assistance
            </p>
          </div>

          {/* Settings Modal */}
          {showSettings && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Settings</h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter your API key"
                  />
                  <p className="mt-2 text-sm text-gray-600">
                    Get your API key from{" "}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 underline"
                    >
                      Google AI Studio
                    </a>
                  </p>
                </div>
                <button
                  onClick={() => saveApiKey(apiKey)}
                  className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}

          {/* Card Type Selection */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <div className="flex space-x-4 mb-6">
              <button
                onClick={() => setCardType("basic")}
                className={`flex-1 py-4 px-6 rounded-lg flex items-center justify-center space-x-2 transition-all ${
                  cardType === "basic"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <SplitSquareHorizontal className="w-5 h-5" />
                <span>Basic Cards</span>
              </button>
              <button
                onClick={() => setCardType("cloze")}
                className={`flex-1 py-4 px-6 rounded-lg flex items-center justify-center space-x-2 transition-all ${
                  cardType === "cloze"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Square className="w-5 h-5" />
                <span>Cloze Cards</span>
              </button>
            </div>

            {/* Text Input */}
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Cards (max 30)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={cardCountInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (
                        val === "" ||
                        (parseInt(val) >= 1 && parseInt(val) <= 30)
                      ) {
                        setCardCountInput(val);
                      }
                    }}
                    onBlur={() => {
                      const num = parseInt(cardCountInput);
                      if (!num || num < 1) {
                        setCardCountInput("1");
                      } else if (num > 30) {
                        setCardCountInput("30");
                      }
                    }}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Input Text
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Enter your text here..."
                  className="w-full h-40 p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !inputText.trim()}
              className="w-full mt-4 py-3 px-6 bg-indigo-600 text-white rounded-lg flex items-center justify-center space-x-2 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <BrainCircuit className="w-5 h-5" />
              )}
              <span>{isGenerating ? "Generating..." : "Generate Cards"}</span>
            </button>
          </div>

          {/* Card Preview */}
          {generatedCards.length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Eye className="w-5 h-5 mr-2" />
                  Preview Cards
                </h2>
                <div className="text-sm text-gray-500">
                  {currentCardIndex + 1} of {generatedCards.length}
                </div>
              </div>

              <div className="min-h-[200px] bg-gray-50 rounded-lg p-6 mb-6">
                {cardType === "basic" ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">
                        Front
                      </h3>
                      <p className="text-lg text-gray-900">
                        {generatedCards[currentCardIndex].front}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">
                        Back
                      </h3>
                      <p className="text-lg text-gray-900">
                        {generatedCards[currentCardIndex].back}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">
                      Cloze
                    </h3>
                    <p className="text-lg text-gray-900">
                      {generatedCards[currentCardIndex].text}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={() =>
                    setCurrentCardIndex((prev) => Math.max(0, prev - 1))
                  }
                  disabled={currentCardIndex === 0}
                  className="py-2 px-4 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={downloadCSV}
                  className="py-2 px-6 bg-green-600 text-white rounded-lg flex items-center space-x-2 hover:bg-green-700 transition-colors"
                >
                  <FileDown className="w-5 h-5" />
                  <span>Download CSV</span>
                </button>
                <button
                  onClick={() =>
                    setCurrentCardIndex((prev) =>
                      Math.min(generatedCards.length - 1, prev + 1)
                    )
                  }
                  disabled={currentCardIndex === generatedCards.length - 1}
                  className="py-2 px-4 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div className="p-6 bg-white rounded-lg shadow-lg">
              <BookOpen className="w-8 h-8 text-indigo-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Basic & Cloze Cards
              </h3>
              <p className="text-gray-600">
                Create both traditional and fill-in-the-blank style flashcards
              </p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-lg">
              <BrainCircuit className="w-8 h-8 text-indigo-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">AI-Powered</h3>
              <p className="text-gray-600">
                Smart generation of cards from any text input
              </p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-lg">
              <Download className="w-8 h-8 text-indigo-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Anki Compatible</h3>
              <p className="text-gray-600">
                Export your cards directly to Anki-compatible CSV format
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
