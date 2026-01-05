import { useState } from "react";
import "./App.css";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface Flashcard {
  question: string;
  answer: string;
}

function App() {
  const [apiKey, setApiKey] = useState("");
  const [topic, setTopic] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const generateFlashcards = async () => {
    if (!apiKey || !topic) {
      setError("Please provide both API key and topic");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const prompt = `Generate 10 flashcards about ${topic}. 
      Format the response as a JSON array of objects with 'question' and 'answer' fields.
      Make the questions clear and concise, and provide detailed but understandable answers.
      Only respond with the JSON array, no additional text.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Remove markdown code blocks if present
      const cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");

      const cards = JSON.parse(cleanedText);
      setFlashcards(cards);
      setCurrentCardIndex(0);
      setShowAnswer(false);
    } catch (err) {
      setError(
        "Failed to generate flashcards. Please check your API key and try again."
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const nextCard = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setShowAnswer(false);
    }
  };

  const previousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setShowAnswer(false);
    }
  };

  const downloadAnkiFile = () => {
    const ankiContent = flashcards
      .map((card) => `${card.question}\t${card.answer}`)
      .join("\n");

    const blob = new Blob([ankiContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topic.replace(/\s+/g, "-")}-flashcards.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="App">
      <div className="container">
        <h1>AI Flashcard Generator</h1>

        <div className="input-section">
          <input
            type="password"
            placeholder="Enter your Gemini API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="input-field"
          />
          <input
            type="text"
            placeholder="Enter topic (e.g., 'Spanish verbs', 'World War 2')"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="input-field"
          />
          <button
            onClick={generateFlashcards}
            disabled={loading}
            className="generate-button"
          >
            {loading ? "Generating..." : "Generate Flashcards"}
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {flashcards.length > 0 && (
          <div className="flashcard-section">
            <div className="card" onClick={() => setShowAnswer(!showAnswer)}>
              <div className="card-content">
                <h3>Question {currentCardIndex + 1}</h3>
                <p className="question">
                  {flashcards[currentCardIndex].question}
                </p>
                {showAnswer && (
                  <div className="answer">
                    <hr />
                    <p>{flashcards[currentCardIndex].answer}</p>
                  </div>
                )}
              </div>
              <p className="click-hint">Click to {showAnswer ? "hide" : "show"} answer</p>
            </div>

            <div className="navigation">
              <button
                onClick={previousCard}
                disabled={currentCardIndex === 0}
                className="nav-button"
              >
                ← Previous
              </button>
              <span className="card-counter">
                {currentCardIndex + 1} / {flashcards.length}
              </span>
              <button
                onClick={nextCard}
                disabled={currentCardIndex === flashcards.length - 1}
                className="nav-button"
              >
                Next →
              </button>
            </div>

            <button onClick={downloadAnkiFile} className="download-button">
              Download for Anki
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
