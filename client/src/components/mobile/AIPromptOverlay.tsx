import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Sparkles, Mic, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface AIPromptOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  onGeneratePlay: (prompt: string) => void;
  isGenerating: boolean;
}

const examplePrompts = [
  "Trips right, Z post",
  "Bunch left, mesh concept",
  "Spread, four verticals",
  "Slot motion, screen left",
];

export function AIPromptOverlay({
  isVisible,
  onClose,
  onGeneratePlay,
  isGenerating,
}: AIPromptOverlayProps) {
  const [prompt, setPrompt] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const { toast } = useToast();

  const hasSpeechRecognition = typeof window !== "undefined" && 
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    if (!hasSpeechRecognition) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setPrompt((prev) => prev + " " + transcript.trim());
      setIsListening(false);
    };

    recognitionRef.current.onerror = () => {
      setIsListening(false);
      toast({
        title: "Voice input error",
        description: "Could not capture speech. Please try again.",
        variant: "destructive",
      });
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    return () => {
      recognitionRef.current?.abort();
    };
  }, [hasSpeechRecognition, toast]);

  const handleVoiceInput = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({
        title: "Please describe your play",
        description: "Enter a description or use voice input.",
        variant: "destructive",
      });
      return;
    }
    onGeneratePlay(prompt.trim());
  };

  const handleChipClick = (examplePrompt: string) => {
    setPrompt(examplePrompt);
  };

  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-[#0d0d1a] flex flex-col"
      data-testid="ai-prompt-overlay"
    >
      <div className="flex justify-between items-center p-4">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <span className="font-semibold">Describe Your Play</span>
        </div>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white p-2"
          data-testid="button-close-ai"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex flex-col px-4 pb-4 gap-4">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Example: Trips right, Z runs a deep post, Y runs a drag across the middle..."
          className="flex-1 min-h-[120px] bg-white/10 border-white/20 text-white placeholder:text-white/50 resize-none"
          data-testid="input-ai-prompt"
        />

        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white h-12"
            data-testid="button-generate-play"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Play"
            )}
          </Button>

          {hasSpeechRecognition && (
            <Button
              onClick={handleVoiceInput}
              variant="outline"
              size="icon"
              className={`h-12 w-12 ${
                isListening 
                  ? "bg-red-500 border-red-500 text-white animate-pulse" 
                  : "border-white/30 text-white hover:bg-white/10"
              }`}
              data-testid="button-voice-input"
            >
              <Mic className="w-5 h-5" />
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <span className="text-xs text-white/60">Quick examples (tap to use)</span>
          <div className="flex flex-wrap gap-2">
            {examplePrompts.map((example) => (
              <button
                key={example}
                onClick={() => handleChipClick(example)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-sm text-white/80 transition-colors"
                data-testid={`chip-example-${example.replace(/\s+/g, "-").toLowerCase()}`}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}
