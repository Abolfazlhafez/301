import { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import { useTranslation } from "react-i18next";
import { useToast } from "./ToastProvider";

interface VoiceRecorderButtonProps {
  disabled?: boolean;
  onRecorded: (blob: Blob, durationSeconds: number, mimeType: string) => void;
}

// اولین فرمتی که مرورگر/WebView از آن پشتیبانی کند (WebM روی اکثر اندرویدها،
// mp4 روی برخی WebViewهای قدیمی‌تر/iOS).
const CANDIDATE_MIME_TYPES = ["audio/webm", "audio/mp4", "audio/ogg"];

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * دکمهٔ ضبط صدا. چون هیچ پلاگین بومی ضبط صدا در این پروژه نصب نیست، از
 * MediaRecorder/getUserMedia استاندارد مرورگر استفاده می‌شود که در WebView
 * اندروید Capacitor هم پشتیبانی می‌شود (پس نیازی به افزودن پلاگین بومی و
 * تغییرات Gradle نبود).
 */
export function VoiceRecorderButton({ disabled, onRecorded }: VoiceRecorderButtonProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [state, setState] = useState<"idle" | "requesting" | "recording">("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function handleStart() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      showToast(t("voiceNote.unsupported") as string, "error");
      return;
    }
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const durationSeconds = (Date.now() - startedAtRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (durationSeconds < 1) {
          showToast(t("voiceNote.tooShort") as string, "warning");
        } else {
          onRecorded(blob, durationSeconds, recorder.mimeType || mimeType || "audio/webm");
        }
      };
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setState("recording");
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.round((Date.now() - startedAtRef.current) / 1000));
      }, 1000);
    } catch {
      setState("idle");
      showToast(t("voiceNote.permissionDenied") as string, "error");
    }
  }

  function handleStop() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setState("idle");
  }

  if (state === "recording") {
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    const label = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    return (
      <Button
        color="error"
        variant="outlined"
        startIcon={<StopIcon />}
        onClick={handleStop}
      >
        {t("voiceNote.recording")} · {label}
      </Button>
    );
  }

  return (
    <Button
      variant="outlined"
      color="inherit"
      disabled={disabled || state === "requesting"}
      startIcon={state === "requesting" ? <CircularProgress size={16} /> : <MicIcon />}
      onClick={handleStart}
    >
      <Box component="span">{t("voiceNote.record")}</Box>
    </Button>
  );
}
