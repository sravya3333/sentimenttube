import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  BarChart3, 
  MessageSquare, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Youtube,
  Github,
  Database,
  BrainCircuit
} from "lucide-react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  Legend
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";

// --- Types ---
interface Comment {
  id: string;
  text: string;
  author: string;
  publishedAt: string;
  sentiment?: "Positive" | "Negative" | "Neutral";
  reasoning?: string;
  confidence?: number;
  keywords?: string[];
}

interface SentimentStats {
  positive: number;
  negative: number;
  neutral: number;
  avgConfidence: number;
}

// --- Constants ---
const COLORS = {
  Positive: "#10b981", // Emerald-500
  Negative: "#ef4444", // Red-500
  Neutral: "#6b7280",  // Gray-500
};

const REASSURING_MESSAGES = [
  "Fetching comments from YouTube...",
  "Analyzing sentiment with Gemini AI...",
  "Calculating emotional distribution...",
  "Generating insights...",
  "Finalizing your dashboard...",
];

export default function App() {
  const [videoUrl, setVideoUrl] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  // --- Loading Message Rotation ---
  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % REASSURING_MESSAGES.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  // --- Sentiment Analysis Logic ---
  const analyzeSentiment = async (commentsToAnalyze: Comment[]) => {
    const res = await fetch("/api/analyze-sentiment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: commentsToAnalyze }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    setUsedFallback(Boolean(data.fallback || !data.usedGemini));
    setComments(data.comments);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl) return;

    setIsLoading(true);
    setError(null);
    setComments([]);
    setLoadingStep(0);
    setUsedFallback(false);

    try {
      const res = await fetch("/api/fetch-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setIsMock(data.isMock);
      await analyzeSentiment(data.comments);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Stats Calculation ---
  const stats = useMemo(() => {
    const s: SentimentStats = { positive: 0, negative: 0, neutral: 0, avgConfidence: 0 };
    let totalConf = 0;
    comments.forEach((c) => {
      if (c.sentiment === "Positive") s.positive++;
      else if (c.sentiment === "Negative") s.negative++;
      else if (c.sentiment === "Neutral") s.neutral++;
      totalConf += c.confidence || 0;
    });
    s.avgConfidence = comments.length > 0 ? totalConf / comments.length : 0;
    return s;
  }, [comments]);

  const timelineData = useMemo(() => {
    return [...comments]
      .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
      .map(c => ({
        time: new Date(c.publishedAt).toLocaleDateString(),
        sentiment: c.sentiment === "Positive" ? 1 : c.sentiment === "Negative" ? -1 : 0,
        confidence: c.confidence
      }));
  }, [comments]);

  const keywordData = useMemo(() => {
    const counts: Record<string, number> = {};
    comments.forEach(c => {
      c.keywords?.forEach(k => {
        const key = k.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [comments]);

  const pythonCode = `
import pandas as pd
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import matplotlib.pyplot as plt

# 1. Load Data
data = pd.read_json('comments.json')

# 2. Initialize VADER
analyzer = SentimentIntensityAnalyzer()

# 3. Analyze Sentiment
def get_sentiment(text):
    score = analyzer.polarity_scores(text)
    if score['compound'] >= 0.05:
        return 'Positive'
    elif score['compound'] <= -0.05:
        return 'Negative'
    else:
        return 'Neutral'

data['sentiment'] = data['text'].apply(get_sentiment)

# 4. Visualize
data['sentiment'].value_counts().plot(kind='pie', autopct='%1.1f%%')
plt.title('YouTube Comment Sentiment Distribution')
plt.show()
  `.trim();

  const chartData = [
    { name: "Positive", value: stats.positive, color: COLORS.Positive },
    { name: "Negative", value: stats.negative, color: COLORS.Negative },
    { name: "Neutral", value: stats.neutral, color: COLORS.Neutral },
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-[#141414] p-2 rounded-sm">
            <Youtube className="text-[#E4E3E0] w-6 h-6" />
          </div>
          <div>
            <h1 className="font-mono font-bold text-xl tracking-tighter uppercase">SentimentTube</h1>
            <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest">YouTube Comment Analyzer v1.0</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2 text-[10px] font-mono uppercase opacity-60">
            <Database className="w-3 h-3" />
            <span>Node.js Backend</span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[10px] font-mono uppercase opacity-60">
            <BrainCircuit className="w-3 h-3" />
            <span>Gemini AI Engine</span>
          </div>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:opacity-60 transition-opacity">
            <Github className="w-5 h-5" />
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-12">
        {/* Search Section */}
        <section className="mb-12">
          <div className="max-w-2xl">
            <h2 className="font-serif italic text-3xl mb-4">Analyze the pulse of any video.</h2>
            <p className="text-sm opacity-70 mb-8 max-w-lg leading-relaxed">
              Paste a YouTube URL below. We'll fetch the latest comments and use Gemini AI to perform deep sentiment analysis, replacing traditional Python NLP stacks with state-of-the-art LLM reasoning.
            </p>
            <form onSubmit={handleAnalyze} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                <input 
                  type="text" 
                  placeholder="https://www.youtube.com/watch?v=..." 
                  className="w-full bg-white border border-[#141414] py-4 pl-12 pr-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#141414]/10 transition-all"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={isLoading}
                className="bg-[#141414] text-[#E4E3E0] px-8 py-4 text-sm font-mono uppercase tracking-widest hover:bg-[#141414]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? "Analyzing..." : "Process"}
              </button>
            </form>
            {isMock && !isLoading && !error && (
              <p className="mt-4 text-[10px] font-mono uppercase text-amber-600 flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                Demo Mode: Using mock YouTube comments (set YOUTUBE_API_KEY in .env for real data)
              </p>
            )}
            {usedFallback && !isLoading && !error && comments.length > 0 && (
              <p className="mt-2 text-[10px] font-mono uppercase text-amber-600 flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                Local sentiment mode active (set GEMINI_API_KEY in .env for Gemini AI analysis)
              </p>
            )}
          </div>
        </section>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center py-24 border border-dashed border-[#141414]/20 rounded-lg"
            >
              <Loader2 className="w-12 h-12 animate-spin mb-6 opacity-20" />
              <p className="font-mono text-xs uppercase tracking-[0.2em] animate-pulse">
                {REASSURING_MESSAGES[loadingStep]}
              </p>
            </motion.div>
          ) : error ? (
            <motion.div 
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 border border-red-200 bg-red-50 text-red-600 rounded-sm flex items-center gap-4"
            >
              <AlertCircle className="w-6 h-6" />
              <p className="font-mono text-sm">{error}</p>
            </motion.div>
          ) : comments.length > 0 ? (
            <motion.div 
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Stats Sidebar */}
              <div className="lg:col-span-1 space-y-8">
                <div className="bg-white border border-[#141414] p-8">
                  <div className="flex items-center gap-2 mb-6">
                    <BarChart3 className="w-4 h-4" />
                    <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Sentiment Overview</h3>
                  </div>
                  <div className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: '#141414', 
                            border: 'none', 
                            borderRadius: '2px',
                            color: '#E4E3E0',
                            fontFamily: 'monospace',
                            fontSize: '10px'
                          }}
                        />
                        <Legend 
                          verticalAlign="bottom" 
                          height={36}
                          formatter={(value) => <span className="text-[10px] font-mono uppercase tracking-widest">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-[#141414]/10">
                    <div className="text-center border-r border-[#141414]/10">
                      <p className="text-[10px] font-mono uppercase opacity-50 mb-1">Avg Confidence</p>
                      <p className="font-mono font-bold text-xl">{(stats.avgConfidence * 100).toFixed(1)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-mono uppercase opacity-50 mb-1">Sample Size</p>
                      <p className="font-mono font-bold text-xl">{comments.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[#141414] p-8">
                  <div className="flex items-center gap-2 mb-6">
                    <TrendingUp className="w-4 h-4" />
                    <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Top Keywords</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {keywordData.map((k, i) => (
                      <span 
                        key={i} 
                        className="px-2 py-1 bg-[#141414]/5 border border-[#141414]/10 text-[10px] font-mono uppercase"
                        style={{ opacity: 0.4 + (k.value / keywordData[0].value) * 0.6 }}
                      >
                        {k.text} ({k.value})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-[#141414] text-[#E4E3E0] p-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Github className="w-4 h-4" />
                    <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Python Integration</h3>
                  </div>
                  <p className="text-[10px] opacity-60 mb-4 leading-relaxed">
                    For offline processing, use the VADER library in Python. It's optimized for social media sentiment.
                  </p>
                  <pre className="text-[9px] font-mono bg-white/5 p-4 overflow-x-auto border border-white/10">
                    {pythonCode}
                  </pre>
                </div>
              </div>

              {/* Comments List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Analyzed Comments</h3>
                  </div>
                  <span className="text-[10px] font-mono opacity-50 uppercase tracking-widest">{comments.length} total</span>
                </div>
                
                <div className="space-y-4">
                  {comments.map((comment, idx) => (
                    <motion.div 
                      key={comment.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group bg-white border border-[#141414] p-6 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all cursor-default"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#141414]/5 group-hover:bg-[#E4E3E0]/10 flex items-center justify-center text-[10px] font-mono font-bold">
                            {comment.author.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[10px] font-mono uppercase font-bold tracking-widest">{comment.author}</p>
                            <p className="text-[9px] font-mono uppercase opacity-40 group-hover:opacity-60">ID: {comment.id.substring(0, 8)}</p>
                          </div>
                        </div>
                        <div className={cn(
                          "px-3 py-1 text-[9px] font-mono uppercase tracking-widest flex items-center gap-2",
                          comment.sentiment === "Positive" && "bg-emerald-100 text-emerald-700 group-hover:bg-emerald-500 group-hover:text-white",
                          comment.sentiment === "Negative" && "bg-red-100 text-red-700 group-hover:bg-red-500 group-hover:text-white",
                          comment.sentiment === "Neutral" && "bg-gray-100 text-gray-700 group-hover:bg-gray-500 group-hover:text-white"
                        )}>
                          {comment.sentiment === "Positive" && <CheckCircle2 className="w-3 h-3" />}
                          {comment.sentiment === "Negative" && <XCircle className="w-3 h-3" />}
                          {comment.sentiment === "Neutral" && <AlertCircle className="w-3 h-3" />}
                          {comment.sentiment}
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed mb-4 font-serif italic">"{comment.text}"</p>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {comment.keywords?.map((k, i) => (
                          <span key={i} className="text-[9px] font-mono uppercase px-2 py-0.5 border border-[#141414]/10 group-hover:border-[#E4E3E0]/20 opacity-60">
                            #{k}
                          </span>
                        ))}
                      </div>

                      <div className="pt-4 border-t border-[#141414]/10 group-hover:border-[#E4E3E0]/10">
                        <p className="text-[9px] font-mono uppercase opacity-40 group-hover:opacity-60 mb-1">Reasoning</p>
                        <p className="text-[10px] font-mono leading-relaxed opacity-70 group-hover:opacity-90">{comment.reasoning}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 border border-dashed border-[#141414]/20 rounded-lg opacity-40">
              <Youtube className="w-12 h-12 mb-4" />
              <p className="font-mono text-[10px] uppercase tracking-[0.3em]">Awaiting Input</p>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#141414] p-12 mt-24">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <h4 className="font-mono font-bold text-xs uppercase tracking-widest mb-6">About SentimentTube</h4>
            <p className="text-sm opacity-60 leading-relaxed max-w-md">
              A modern full-stack application demonstrating the power of Gemini AI in natural language processing. 
              By combining a Node.js backend with a React frontend, we provide real-time emotional insights from public discourse.
            </p>
          </div>
          <div>
            <h4 className="font-mono font-bold text-xs uppercase tracking-widest mb-6">Stack</h4>
            <ul className="text-[10px] font-mono uppercase space-y-2 opacity-60">
              <li>React 19 + Vite</li>
              <li>Tailwind CSS 4</li>
              <li>Express + Node.js</li>
              <li>Google Gemini</li>
              <li>Recharts</li>
            </ul>
          </div>
          <div>
            <h4 className="font-mono font-bold text-xs uppercase tracking-widest mb-6">Legal</h4>
            <ul className="text-[10px] font-mono uppercase space-y-2 opacity-60">
              <li>Privacy Policy</li>
              <li>Terms of Service</li>
              <li>API Usage</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-24 pt-12 border-t border-[#141414]/10 flex justify-between items-center">
          <p className="text-[10px] font-mono uppercase opacity-40">© 2026 SentimentTube. All rights reserved.</p>
          <div className="flex gap-6">
            <span className="text-[10px] font-mono uppercase opacity-40">Status: Operational</span>
            <span className="text-[10px] font-mono uppercase opacity-40">Region: Global</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
