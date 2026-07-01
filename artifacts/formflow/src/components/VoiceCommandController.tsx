/// <reference lib="dom" />
import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, AlertCircle } from "lucide-react";

export type VoiceCommand =
  | "practice" | "begin" | "done" | "restart" | "repeat" | "calibrate"
  | "overlay_on" | "overlay_off" | "show_instructor" | "hide_instructor"
  | "skeleton_only" | "video_only";

interface Props {
  onCommand: (cmd: VoiceCommand) => void;
  enabled?: boolean;
}

const COMMAND_MAP: Record<string, VoiceCommand> = {
  "practice": "practice", "training": "practice",
  "begin": "begin", "start": "begin", "go": "begin", "i'm ready": "begin", "im ready": "begin",
  "done": "done", "finish": "done", "finished": "done",
  "restart": "restart", "repeat": "repeat",
  "calibrate": "calibrate",
  "overlay": "overlay_on", "show overlay": "overlay_on",
  "no overlay": "overlay_off", "hide overlay": "overlay_off",
  "show instructor": "show_instructor", "hide instructor": "hide_instructor",
  "skeleton only": "skeleton_only", "video only": "video_only",
};

export default function VoiceCommandController({ onCommand, enabled = true }: Props) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState<string>("");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SR);
    if (!SR) return;

    const rec = new SR() as any;
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onresult = (e: any) => {
      const text = (e.results[e.results.length - 1][0].transcript as string).trim().toLowerCase();
      setLastHeard(text);
      for (const [phrase, cmd] of Object.entries(COMMAND_MAP)) {
        if (text.includes(phrase)) { onCommand(cmd); break; }
      }
    };

    rec.onerror = (e: any) => {
      if (e.error !== "no-speech") setError(`Voice error: ${e.error}`);
    };

    rec.onend = () => {
      if (listening) {
        try { rec.start(); } catch {}
      }
    };

    recognitionRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
  }, []);

  const toggle = useCallback(() => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
        setError(null);
      } catch (err) {
        setError("Could not start voice recognition");
      }
    }
  }, [listening]);

  if (!enabled) return null;

  return (
    <div className="flex items-center gap-2">
      {!supported ? (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <AlertCircle className="w-3 h-3" />
          <span>Voice unavailable</span>
        </div>
      ) : (
        <button
          onClick={toggle}
          title={listening ? "Stop voice commands" : "Start voice commands"}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
            listening
              ? "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
              : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500"
          }`}
        >
          {listening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          {listening ? "Listening…" : "Voice"}
        </button>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
      {lastHeard && listening && (
        <span className="text-xs text-gray-500 max-w-[120px] truncate">"{lastHeard}"</span>
      )}
    </div>
  );
}

export function useSpeechSynthesis() {
  const speak = useCallback((text: string, rate = 1.0) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = rate;
    utt.pitch = 1.0;
    window.speechSynthesis.speak(utt);
  }, []);

  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel();
  }, []);

  return { speak, cancel };
}
