'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useDropzone } from "react-dropzone"
import { useEngagement } from "@/contexts/EngagementContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import {
  Mic,
  MicOff,
  Upload,
  Volume2,
  Loader2,
  Trash,
  Languages,
  FileAudio,
  Download,
} from "lucide-react"
import { KOLWEZI_COMMUNITIES, SUPPORTED_LANGUAGES, ALL_LANGUAGES } from "@/lib/types"
import { toast } from "sonner"
import { Textarea } from "./ui/textarea"


interface EngagementDialogProps {
  isOpen: boolean
  onClose: () => void
  socialWorkerName: string
  engagementDate: string
}

export default function EngagementDialog({
  isOpen,
  onClose,
  socialWorkerName,
  engagementDate,
}: EngagementDialogProps) {
  const { data, updateData, resetData, recoverData, isRecovering } = useEngagement()
  
  // Local state for UI-specific functionality
  const [isManualError, setIsManualError] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const [recoveryData, setRecoveryData] = useState<any>(null)
  const [forceRefresh, setForceRefresh] = useState(0)
  const [dataJustRecovered, setDataJustRecovered] = useState(false)

  // Refs for audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const backupIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".webm"] },
    maxSize: 50 * 1024 * 1024,
    onDrop: async (files) => {
      const f = files[0]
      updateData({
        audioFile: f,
        recordedAudio: null,
        audioUrl: URL.createObjectURL(f)
      })
      
      // Backup uploaded file
      const newBackupKey = generateBackupKey();
      updateData({ backupKey: newBackupKey });
      await saveAudioToLocalStorage(f, newBackupKey);
      
      // No toast - upload completed silently
    },
    onDropRejected: () => {
      toast.error("Invalid file. Max 50MB audio only.")
    },
  })

  const isLangUnsupported = (lang: any) => !SUPPORTED_LANGUAGES.includes(lang);

  // Audio backup and recovery functions
  const generateBackupKey = () => {
    return `audio_backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const saveCompleteDataToLocalStorage = async (audioBlob: Blob, key: string) => {
    try {
      // Check if blob is too large for localStorage (limit to 5MB)
      if (audioBlob.size > 5 * 1024 * 1024) {
        console.warn("Audio too large for localStorage backup, skipping...");
        return;
      }

      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to base64 in chunks to avoid call stack overflow
      let base64 = '';
      const chunkSize = 8192; // Process in 8KB chunks
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        // Use Array.from to convert Uint8Array to regular array for btoa
        const chunkArray = Array.from(chunk);
        base64 += btoa(String.fromCharCode(...chunkArray));
      }
      
      const backupData = {
        audioData: base64,
        timestamp: Date.now(),
        type: audioBlob.type,
        size: audioBlob.size,
        // Include all form data
        formData: {
          recordingName: data.recordingName,
          community: data.community,
          language: data.language,
          socialWorkerName: data.socialWorkerName,
          engagementDate: data.engagementDate,
          transcription: data.transcription,
          translation: data.translation,
          summary: data.summary,
          isManualTranscript: data.isManualTranscript,
          recordingTime: data.recordingTime
        }
      };
      
      localStorage.setItem(key, JSON.stringify(backupData));
      updateData({ isBackedUp: true });
      // No toast - backup happens automatically
    } catch (error) {
      console.error("Failed to backup data:", error);
      toast.error("Failed to backup data locally");
    }
  };

  const saveAudioToLocalStorage = async (audioBlob: Blob, key: string) => {
    await saveCompleteDataToLocalStorage(audioBlob, key);
  };

  const loadCompleteDataFromLocalStorage = (key: string): { blob: Blob | null, formData: any } => {
    try {
      const backupData = localStorage.getItem(key);
      if (!backupData) return { blob: null, formData: null };
      
      const parsed = JSON.parse(backupData);
      const { audioData, type, formData } = parsed;
      
      if (!audioData) return { blob: null, formData };
      
      // Check if the data is already a valid base64 string
      let binaryString;
      try {
        // Try to decode as base64
        binaryString = atob(audioData);
      } catch (base64Error) {
        console.warn("Data is not base64 encoded, treating as raw data");
        // If it's not base64, treat it as raw string data
        binaryString = audioData;
      }
      
      const bytes = new Uint8Array(binaryString.length);
      
      // Convert binary string to bytes
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return { blob: new Blob([bytes], { type: type || 'audio/webm' }), formData };
    } catch (error) {
      console.error("Failed to load data from backup:", error);
      // Return form data even if audio fails to load
      const backupData = localStorage.getItem(key);
      if (backupData) {
        try {
          const parsed = JSON.parse(backupData);
          return { blob: null, formData: parsed.formData || null };
        } catch (parseError) {
          console.error("Failed to parse backup data:", parseError);
        }
      }
      return { blob: null, formData: null };
    }
  };

  const loadAudioFromLocalStorage = (key: string): Blob | null => {
    const { blob } = loadCompleteDataFromLocalStorage(key);
    return blob;
  };

  const clearAudioBackup = (key: string) => {
    try {
      localStorage.removeItem(key);
      updateData({ isBackedUp: false });
    } catch (error) {
      console.error("Failed to clear audio backup:", error);
    }
  };

  const getAvailableBackups = () => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('audio_backup_'));
    const validBackups: any[] = [];
    const corruptedKeys: string[] = [];
    
    keys.forEach(key => {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          // Test if audio data can be decoded
          if (parsed.audioData) {
            try {
              atob(parsed.audioData.substring(0, 100)); // Test first 100 chars
            } catch (e) {
              // If base64 decoding fails, mark as corrupted
              corruptedKeys.push(key);
              return;
            }
          }
          validBackups.push({
            key,
            timestamp: parsed.timestamp,
            formData: parsed.formData,
            size: parsed.size
          });
        }
      } catch (error) {
        console.warn(`Corrupted backup data found: ${key}`, error);
        corruptedKeys.push(key);
      }
    });
    
    // Clean up corrupted backups
    if (corruptedKeys.length > 0) {
      corruptedKeys.forEach(key => {
        localStorage.removeItem(key);
      });
      toast.info(`Cleaned up ${corruptedKeys.length} corrupted backup(s)`);
    }
    
    return validBackups.sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
  };

  const handleRecoveryClick = () => {
    const backups = getAvailableBackups();
    if (backups.length === 0) {
      toast.info("No backup data found");
      return;
    }
    setRecoveryData(backups);
    setShowRecoveryDialog(true);
  };

  const handleRecoverData = (backup: any) => {
    console.log("Recovering data from backup:", backup);
    const { blob, formData } = loadCompleteDataFromLocalStorage(backup.key);
    console.log("Loaded data:", { blob: !!blob, formData });
    
    if (formData) {
      // Prepare recovery data with audio
      const recoveryData = {
        ...formData,
        key: backup.key,
        audioBlob: blob
      };
      
      // Use context to recover data
      recoverData(recoveryData);
      
      // Handle audio separately
      if (blob) {
        updateData({
          recordedAudio: blob,
          audioFile: null,
          audioUrl: URL.createObjectURL(blob),
          isBackedUp: true
        });
        // No toast - visual indicator will show instead
      } else {
        updateData({
          recordedAudio: null,
          audioFile: null,
          audioUrl: null,
          isBackedUp: false
        });
        // No toast - visual indicator will show instead
      }
      
      // Set recovery flag and force refresh
      setDataJustRecovered(true);
      setForceRefresh(prev => prev + 1);
      
      // Clear recovery flag after a few seconds
      setTimeout(() => setDataJustRecovered(false), 5000);
      
      // Close recovery dialog after a short delay to show the success message
      setTimeout(() => {
        setShowRecoveryDialog(false);
        setRecoveryData(null);
      }, 1500);
    } else {
      console.error("No form data found in backup");
      toast.error("Failed to recover data - backup may be corrupted");
    }
  };

  const downloadText = (text: string, filename: string, type: 'transcript' | 'summary' | 'translation') => {
    if (!text.trim()) {
      toast.error(`No ${type} available to download`);
      return;
    }

    try {
      // Create a formatted text content
      const header = `Community Engagement ${type.charAt(0).toUpperCase() + type.slice(1)}\n`;
      const separator = "=".repeat(50) + "\n\n";
      const metadata = `Recording Name: ${data.recordingName}\n`;
      const communityInfo = `Community: ${data.community}\n`;
      const languageInfo = `Language: ${data.language}\n`;
      const socialWorkerInfo = `Social Worker: ${data.socialWorkerName}\n`;
      const dateInfo = `Engagement Date: ${data.engagementDate}\n`;
      const recordingTimeInfo = `Recording Duration: ${formatTime(data.recordingTime)}\n\n`;
      
      const content = header + separator + 
        metadata + communityInfo + languageInfo + socialWorkerInfo + 
        dateInfo + recordingTimeInfo + 
        `${type.charAt(0).toUpperCase() + type.slice(1)}:\n` +
        "-".repeat(20) + "\n" +
        text;

      // Create and download the file
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}_${type}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} downloaded successfully!`);
    } catch (error) {
      console.error(`Failed to download ${type}:`, error);
      toast.error(`Failed to download ${type}`);
    }
  };

  const downloadTranscript = () => {
    const filename = data.recordingName.replace(/[^a-zA-Z0-9]/g, '_') || 'transcript';
    downloadText(data.transcription, filename, 'transcript');
  };

  const downloadSummary = () => {
    const filename = data.recordingName.replace(/[^a-zA-Z0-9]/g, '_') || 'summary';
    downloadText(data.summary, filename, 'summary');
  };

  const handleLanguageChange = (val: any) => {
    updateData({ language: val });
    const unsupported = isLangUnsupported(val);
    updateData({ isManualTranscript: unsupported });
    if (unsupported) {
      setIsManualError(true);
      updateData({ transcription: "" });
      toast.warning("This language is unsupported. Please enter the transcript manually.");
    }
    
    // Backup form data when language changes
    if (data.backupKey && (data.recordedAudio || data.audioFile)) {
      const blob = data.recordedAudio || data.audioFile!;
      saveCompleteDataToLocalStorage(blob, data.backupKey);
    }
  };

 

  const sortedLanguages = useMemo(() => {
    
    const supported = ALL_LANGUAGES
      .filter((l) => SUPPORTED_LANGUAGES.includes(l as any))
      .sort((a, b) => a.localeCompare(b));

    const unsupported = ALL_LANGUAGES
      .filter((l) => !SUPPORTED_LANGUAGES.includes(l as any))
      .sort((a, b) => a.localeCompare(b));

    return [...supported, ...unsupported];
  }, []);

  const LANGUAGE_CODE_MAP: Record<string,string> = {
    English:  "en",
    French:   "fr",
    Swahili:  "sw",
    Lingala:  "ln",
    Balubakat: "lua",
    Kibemba:  "bem",
  };
  
  useEffect(() => {
    return () => {
      intervalRef.current?.unref && intervalRef.current.unref()
      clearInterval(intervalRef.current!)
      cancelAnimationFrame(animationRef.current)
      audioCtxRef.current?.close()
    }
  }, [])

  
  const handleTranscribe = useCallback(async () => {
    const blob = data.recordedAudio || data.audioFile;
    if (!blob || data.isManualTranscript) return;
  
    updateData({ isTranscribing: true });
    try {
      const fd = new FormData();
      fd.append("file", blob, "temp.webm");
      
      // Use the backend transcription API instead of ElevenLabs
      const res = await fetch("/api/audio/transcribe-saved", {
        method: "POST",
        body: fd,
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Transcription failed: ${errorText}`);
      }
  
      const json = await res.json();
      updateData({ transcription: json.transcription || "" });
      // No toast - transcription completed silently
    } catch (err) {
      console.error("Transcription failed:", err);
      toast.error("Transcription failed. Please try manual transcription.");
    } finally {
      updateData({ isTranscribing: false });
    }
  }, [data.audioFile, data.recordedAudio, data.isManualTranscript]);

  const handleTranslate = async (text: string) => {
    if (!text || isLangUnsupported(data.language)) return;
    
    try {
      const res = await fetch("/api/audio/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      
      if (!res.ok) throw new Error("Translation failed");
      
      const json = await res.json();
      updateData({ translation: json.translatedText || "" });
      return json.translatedText || "";
    } catch (err) {
      console.error("Translation failed:", err);
      toast.error("Translation failed");
      return "";
    }
  };

  const handleSummarize = async (text: string) => {
    if (!text) return;
    
    try {
      const res = await fetch("/api/audio/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ translatedText: text }),
      });
      
      if (!res.ok) throw new Error("Summary failed");
      
      const json = await res.json();
      updateData({ summary: json.summary || "" });
      return json.summary || "";
    } catch (err) {
      console.error("Summary failed:", err);
      toast.error("Summary failed");
      return "";
    }
  };

  const processAudioAutomatically = async () => {
    if (!data.transcription || data.isProcessing) return;
    
    updateData({ isProcessing: true });
    try {
      // Step 1: Translate if language is not English
      let textToSummarize = data.transcription;
      if (data.language !== "English" && data.transcription) {
        toast.loading("Translating to English...", { id: "auto-process" });
        const translated = await handleTranslate(data.transcription);
        if (translated) {
          textToSummarize = translated;
        }
      }
      
      // Step 2: Generate summary
      if (textToSummarize) {
        toast.loading("Generating summary...", { id: "auto-process" });
        await handleSummarize(textToSummarize);
      }
      
      toast.dismiss("auto-process");
      // No success toast - processing completed silently
      
      // Update backup with new data
      if (data.backupKey && (data.recordedAudio || data.audioFile)) {
        const blob = data.recordedAudio || data.audioFile!;
        await saveCompleteDataToLocalStorage(blob, data.backupKey);
      }
    } catch (err) {
      console.error("Automatic processing failed:", err);
      toast.dismiss("auto-process");
      toast.error("Automatic processing failed");
    } finally {
      updateData({ isProcessing: false });
    }
  };
  

  useEffect(() => {
    if (data.audioUrl && !data.didTranscribe && !data.isManualTranscript) {
      updateData({ didTranscribe: true });
      handleTranscribe();
    }
  }, [data.audioUrl, data.didTranscribe, data.isManualTranscript, handleTranscribe])

  // Auto-process after transcription is complete
  useEffect(() => {
    if (data.transcription && !data.isProcessing && !data.translation && !data.summary && !data.isManualTranscript) {
      // Small delay to ensure transcription is fully complete
      const timer = setTimeout(() => {
        processAudioAutomatically();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [data.transcription, data.isProcessing, data.translation, data.summary, data.isManualTranscript]);

  // Backup data when transcription changes
  useEffect(() => {
    if (data.transcription && data.backupKey && (data.recordedAudio || data.audioFile)) {
      const blob = data.recordedAudio || data.audioFile!;
      saveCompleteDataToLocalStorage(blob, data.backupKey);
    }
  }, [data.transcription, data.backupKey, data.recordedAudio, data.audioFile]);

  // Backup data when translation changes
  useEffect(() => {
    if (data.translation && data.backupKey && (data.recordedAudio || data.audioFile)) {
      const blob = data.recordedAudio || data.audioFile!;
      saveCompleteDataToLocalStorage(blob, data.backupKey);
    }
  }, [data.translation, data.backupKey, data.recordedAudio, data.audioFile]);

  // Backup data when summary changes
  useEffect(() => {
    if (data.summary && data.backupKey && (data.recordedAudio || data.audioFile)) {
      const blob = data.recordedAudio || data.audioFile!;
      saveCompleteDataToLocalStorage(blob, data.backupKey);
    }
  }, [data.summary, data.backupKey, data.recordedAudio, data.audioFile]);

  // Backup data when recording name changes
  useEffect(() => {
    if (data.recordingName && data.backupKey && (data.recordedAudio || data.audioFile)) {
      const blob = data.recordedAudio || data.audioFile!;
      saveCompleteDataToLocalStorage(blob, data.backupKey);
    }
  }, [data.recordingName, data.backupKey, data.recordedAudio, data.audioFile]);

  // Backup data when community changes
  useEffect(() => {
    if (data.community && data.backupKey && (data.recordedAudio || data.audioFile)) {
      const blob = data.recordedAudio || data.audioFile!;
      saveCompleteDataToLocalStorage(blob, data.backupKey);
    }
  }, [data.community, data.backupKey, data.recordedAudio, data.audioFile]);

 
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      // Generate backup key for this recording session
      const newBackupKey = generateBackupKey();
      updateData({ backupKey: newBackupKey });

      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      ctx.createMediaStreamSource(stream).connect(analyser)

      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data)
      }
      
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        updateData({
          recordedAudio: blob,
          audioFile: null,
          audioUrl: URL.createObjectURL(blob)
        })
        
        // Final backup of complete recording
        await saveAudioToLocalStorage(blob, newBackupKey);
        
        stream.getTracks().forEach((t) => t.stop())
        clearInterval(intervalRef.current!)
      }

      mediaRecorderRef.current.start(10000) // Start with 10-second intervals
      setIsRecording(true)
      updateData({ recordingTime: 0 })
      
      // Timer for recording duration
      intervalRef.current = setInterval(() => {
        updateData({ recordingTime: data.recordingTime + 1 });
      }, 1000)
      
      // Periodic backup every 30 seconds during recording
      backupIntervalRef.current = setInterval(async () => {
        if (audioChunksRef.current.length > 0) {
          const tempBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          await saveAudioToLocalStorage(tempBlob, newBackupKey);
        }
      }, 30000) // Backup every 30 seconds
      
      drawWaveform()
      // No toast - recording started silently
    } catch {
      toast.error("Cannot access microphone.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      cancelAnimationFrame(animationRef.current)
      audioCtxRef.current?.close()
      
      // Clear backup interval
      if (backupIntervalRef.current) {
        clearInterval(backupIntervalRef.current);
        backupIntervalRef.current = null;
      }
      
      // No toast - recording stopped silently
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  
  const drawWaveform = () => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return
    const ctx = canvas.getContext("2d")!
    const data = new Uint8Array(analyser.frequencyBinCount)

    const loop = () => {
      if (!isRecording) return
      analyser.getByteFrequencyData(data)
      ctx.fillStyle = "hsl(var(--audio-background))"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = "hsl(var(--border))"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, canvas.height/2)
      ctx.lineTo(canvas.width, canvas.height/2)
      ctx.stroke()

      const barW = Math.max(2, canvas.width / data.length)
      let x = 0
      for (let v of data) {
        const h = (v / 255) * (canvas.height/2)
        const grad = ctx.createLinearGradient(
          0,
          canvas.height/2 - h,
          0,
          canvas.height/2 + h
        )
        grad.addColorStop(0, "hsl(var(--audio-waveform)/0.8)")
        grad.addColorStop(0.5, "hsl(var(--audio-waveform))")
        grad.addColorStop(1, "hsl(var(--audio-waveform)/0.8)")
        ctx.fillStyle = grad
        ctx.fillRect(x, canvas.height/2 - h, barW-1, h*2)
        x += barW
      }

      animationRef.current = requestAnimationFrame(loop)
    }

    loop()
  }

  
  const handleSave = async () => {
    if (
      !data.recordingName ||
      !data.community ||
      !data.language ||
      !data.transcription ||
      !(data.recordedAudio || data.audioFile)
    ) {
      return toast.error("Fill all fields and transcribe first.");
    }
  
    setIsLoading(true);
    try {
      // 1) Read the blob as base64
      const blob = data.recordedAudio || data.audioFile!;
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(blob);
      });
  
      // 2) POST it
      const payload = {
        audioData: base64,
        socialWorkerName: data.socialWorkerName,
        engagementDate: data.engagementDate,
        recordingName: data.recordingName,
        community: data.community,
        language: data.language,
        transcription: data.transcription,
        translate_to_english: data.translation,
        summary: data.summary,
      };
      
      // Show progress toast
      toast.loading("Saving meeting to database...", { id: "save-progress" });
      
      const res = await fetch("/api/audio/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save failed");
  
      const responseData = await res.json();
      
      // Clear backup after successful save
      if (data.backupKey) {
        clearAudioBackup(data.backupKey);
      }
      
      toast.dismiss("save-progress");
      toast.success("Meeting saved successfully with all processing complete!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.dismiss("save-progress");
      toast.error("Save failed. Your audio is backed up locally and can be recovered.");
    } finally {
      setIsLoading(false);
    }
  };
  

  useEffect(() => {
    if (data.language && isLangUnsupported(data.language)) {
      setIsManualError(true);
    } else {
      setIsManualError(false);
    }
  }, [data.language]);

  // Auto-recover data when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Look for any existing complete data backup
      const keys = Object.keys(localStorage).filter(key => key.startsWith('audio_backup_'));
      if (keys.length > 0) {
        // Sort by timestamp (newest first)
        const sortedKeys = keys.sort((a, b) => {
          try {
            const dataA = JSON.parse(localStorage.getItem(a) || '{}');
            const dataB = JSON.parse(localStorage.getItem(b) || '{}');
            return (dataB.timestamp || 0) - (dataA.timestamp || 0);
          } catch {
            return 0;
          }
        });
        
        const mostRecentKey = sortedKeys[0];
        if (mostRecentKey) {
          try {
            const backupData = JSON.parse(localStorage.getItem(mostRecentKey) || '{}');
            
            // Check if this is a complete backup with form data
            if (backupData.formData) {
              console.log("Found complete backup data, auto-recovering:", backupData.formData);
              
              // Auto-recover the data
              const { blob, formData } = loadCompleteDataFromLocalStorage(mostRecentKey);
              
              if (formData) {
                // Prepare recovery data
                const recoveryData = {
                  ...formData,
                  key: mostRecentKey,
                  audioBlob: blob
                };
                
                // Use context to recover data
                recoverData(recoveryData);
                
                // Handle audio separately
                if (blob) {
                  updateData({
                    recordedAudio: blob,
                    audioFile: null,
                    audioUrl: URL.createObjectURL(blob),
                    isBackedUp: true
                  });
                  // No toast - visual indicator will show instead
                } else {
                  updateData({
                    recordedAudio: null,
                    audioFile: null,
                    audioUrl: null,
                    isBackedUp: false
                  });
                  // No toast - visual indicator will show instead
                }
                
                // Set recovery flag and force refresh
                setDataJustRecovered(true);
                setForceRefresh(prev => prev + 1);
                
                // Clear recovery flag after a few seconds
                setTimeout(() => setDataJustRecovered(false), 5000);
              }
            } else {
              // Legacy audio-only backup
              const backupTime = backupData.timestamp || 0;
              const now = Date.now();
              const hoursSinceBackup = (now - backupTime) / (1000 * 60 * 60);
              
              // Legacy audio-only backups are handled silently now
              // No toast notification for legacy backups
            }
          } catch (error) {
            console.error("Error checking backup data:", error);
          }
        }
      }
    }
  }, [isOpen, recoverData, updateData]);
  

  
  useEffect(() => {
    if (!isOpen) {
      resetData();
      
      // Clear intervals
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (backupIntervalRef.current) {
        clearInterval(backupIntervalRef.current);
        backupIntervalRef.current = null;
      }
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="min-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Engagement Record</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Info Fields */}
          <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="space-y-2">
              <Label>Social Worker</Label>
              <div className="p-2 bg-background border rounded">
                {socialWorkerName}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Engagement Date</Label>
              <div className="p-2 bg-background border rounded">
                {engagementDate}
              </div>
            </div>
          </div>

          {/* Recovery Success Indicator */}
          {dataJustRecovered && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <div>
                <p className="text-sm font-medium text-green-800">Data Successfully Recovered!</p>
                <p className="text-xs text-green-600">Your backed up data has been loaded into the form below.</p>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid md:grid-cols-2 w-full gap-4">
            <div className="space-y-2">
              <Label>Recording Name *</Label>
              <Input
                key={`recording-name-${forceRefresh}`}
                value={data.recordingName}
                onChange={(e) => updateData({ recordingName: e.target.value })}
                placeholder="Please enter a name for the recording"
              />
            </div>
            <div className="space-y-2">
              <Label>Community *</Label>
              <Select
                key={`community-${forceRefresh}`}
                value={data.community}
                onValueChange={(value) => updateData({ community: value })}

              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select community" />
                </SelectTrigger>
                <SelectContent className="w-full">
                  {KOLWEZI_COMMUNITIES.map((community) => (
                    <SelectItem key={community} value={community}>
                      {community}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Language *</Label>
              <Select
                key={`language-${forceRefresh}`}
                value={data.language}
                onValueChange={handleLanguageChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent className="w-full">
                {sortedLanguages.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isManualError && (
                  <p className="text-red-500 text-sm">
                    This language is currently not supported by our transcription system. Please enter the transcription manually in the field below.
                  </p>
              )}
            </div>
          </div>

          {/* Audio Upload & Record */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Upload */}
            <Card>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center ${
                    isDragActive
                      ? "border-primary bg-primary/10"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-8 w-8 mx-auto mb-2" />
                  <p>Upload or drag & drop</p>
                  <p className="mt-2 text-xs text-muted-foreground font-mono">supported file .mp3, .wav, .m4a, .ogg, .webm</p>
                </div>
              </CardContent>
            </Card>
            {/* Record */}
            <Card>
              <CardContent>
                <div className="text-center space-y-4">
                  <Button
                    onClick={
                      isRecording ? stopRecording : startRecording
                    }
                    variant={
                      isRecording ? "destructive" : "default"
                    }
                    size="lg"
                    className="gap-2"
                    disabled={!isRecording && (!data.recordingName || !data.community || !data.language)}
                  >
                    {isRecording ? (
                      <><MicOff /><span>Stop</span></>
                    ) : (
                      <><Mic /><span>Record</span></>
                    )}
                  </Button>
                  {isRecording && (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Recording…</span>
                        <span>{formatTime(data.recordingTime)}</span>
                      </div>
                      <canvas
                        ref={canvasRef}
                        width={400}
                        height={80}
                        className="w-full border rounded"
                      />
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span>Auto-backup enabled</span>
                      </div>
                    </div>
                  )}
                  {!isRecording && (data.recordedAudio || data.audioFile) && (
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      {data.isBackedUp ? (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Backed up locally</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <span>Not backed up</span>
                        </>
                      )}
                    </div>
                  )}
                  {!isRecording && (!data.recordingName || !data.community || !data.language) && (
                    <div className="text-xs text-muted-foreground text-center">
                      <p>Please fill in Recording Name, Community, and Language to start recording</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview + Auto-Transcript */}
            {data.audioUrl && (
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 /><span>Audio Preview</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {data.transcription && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadTranscript}
                        className="gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download Transcript
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm Audio Removal</AlertDialogTitle>
                          <p>This will remove the uploaded or recorded audio permanently from this session. You will need to re-upload or record again if you proceed.</p>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-white"
                            onClick={() => {
                              updateData({
                                audioUrl: null,
                                audioFile: null,
                                recordedAudio: null,
                                didTranscribe: false,
                                transcription: ""
                              });
                              toast.info("Audio removed.");
                            }}
                          >
                            Yes, remove audio
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <audio controls src={data.audioUrl} className="w-full" />

                {data.isManualTranscript ? (
                  <div className="space-y-2">
                    <Label>Manual Transcription *</Label>
                    {isManualError && (
                      <p className="text-red-500 text-sm">
                        This language is currently not supported by our transcription system. Please enter the transcription manually in the field below.
                      </p>
                    )}
                    <Textarea
                      key={`manual-transcription-${forceRefresh}`}
                      value={data.transcription}
                      onChange={(e) => updateData({ transcription: e.target.value })}
                      placeholder="Please type the transcript manually here..."
                      className="min-h-[200px]"
                    />
                  </div>
                ) : (
                  <>
                    {data.isTranscribing && (
                      <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="animate-spin" />
                        <span>Transcribing…</span>
                      </div>
                    )}
                    {data.transcription && (
                      <Textarea
                        key={`auto-transcription-${forceRefresh}`}
                        readOnly
                        value={data.transcription}
                        className="w-full h-80 border rounded p-2"
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Translation Display */}
          {data.translation && (
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Languages className="w-5 h-5" />
                    <span className="font-semibold">English Translation</span>
                    {data.isProcessing && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="animate-spin w-4 h-4" />
                        <span>Processing...</span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const filename = data.recordingName.replace(/[^a-zA-Z0-9]/g, '_') || 'translation';
                      downloadText(data.translation, filename, 'translation');
                    }}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Translation
                  </Button>
                </div>
                <Textarea
                  key={`translation-${forceRefresh}`}
                  readOnly
                  value={data.translation}
                  className="w-full h-60 border rounded p-2"
                  placeholder="Translation will appear here..."
                />
              </CardContent>
            </Card>
          )}

          {/* Summary Display */}
          {data.summary && (
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileAudio className="w-5 h-5" />
                    <span className="font-semibold">Summary</span>
                    {data.isProcessing && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="animate-spin w-4 h-4" />
                        <span>Processing...</span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadSummary}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Summary
                  </Button>
                </div>
                <Textarea
                  key={`summary-${forceRefresh}`}
                  readOnly
                  value={data.summary}
                  className="w-full h-40 border rounded p-2"
                  placeholder="Summary will appear here..."
                />
              </CardContent>
            </Card>
          )}


          {/* Actions */}
          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={handleRecoveryClick}
              disabled={isLoading}
              className="disabled:opacity-50"
            >
              Recover Data
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="disabled:opacity-50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!data.transcription || isLoading}
                className="disabled:opacity-50"
              >
                {isLoading ? (
                  "Saving..."
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Recovery Dialog */}
      <Dialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
        <DialogContent className="min-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recover Backed Up Data</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Select a backup to recover your data. The data will be automatically loaded into the form.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            {recoveryData && recoveryData.length > 0 ? (
              recoveryData.map((backup: any, index: number) => (
                <Card key={backup.key} className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">
                          {backup.formData?.recordingName || "Unnamed Recording"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(backup.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {backup.formData?.transcription && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const filename = (backup.formData?.recordingName || 'transcript').replace(/[^a-zA-Z0-9]/g, '_');
                              downloadText(backup.formData.transcription, filename, 'transcript');
                            }}
                            className="gap-1"
                          >
                            <Download className="w-3 h-3" />
                            Transcript
                          </Button>
                        )}
                        {backup.formData?.translation && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const filename = (backup.formData?.recordingName || 'translation').replace(/[^a-zA-Z0-9]/g, '_');
                              downloadText(backup.formData.translation, filename, 'translation');
                            }}
                            className="gap-1"
                          >
                            <Download className="w-3 h-3" />
                            Translation
                          </Button>
                        )}
                        {backup.formData?.summary && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const filename = (backup.formData?.recordingName || 'summary').replace(/[^a-zA-Z0-9]/g, '_');
                              downloadText(backup.formData.summary, filename, 'summary');
                            }}
                            className="gap-1"
                          >
                            <Download className="w-3 h-3" />
                            Summary
                          </Button>
                        )}
                        <Button
                          onClick={() => handleRecoverData(backup)}
                          size="sm"
                        >
                          Recover
                        </Button>
                      </div>
                    </div>
                    
                    {backup.formData && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <strong>Recording Name:</strong> {backup.formData.recordingName || "N/A"}
                          </div>
                          <div>
                            <strong>Community:</strong> {backup.formData.community || "N/A"}
                          </div>
                          <div>
                            <strong>Language:</strong> {backup.formData.language || "N/A"}
                          </div>
                          <div>
                            <strong>Recording Time:</strong> {backup.formData.recordingTime ? `${Math.floor(backup.formData.recordingTime / 60)}:${(backup.formData.recordingTime % 60).toString().padStart(2, '0')}` : "N/A"}
                          </div>
                          <div>
                            <strong>File Size:</strong> {backup.size ? `${(backup.size / 1024 / 1024).toFixed(2)} MB` : "N/A"}
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          {backup.formData.transcription && (
                            <Badge variant="secondary" className="text-xs">
                              ✓ Transcription
                            </Badge>
                          )}
                          {backup.formData.translation && (
                            <Badge variant="secondary" className="text-xs">
                              ✓ Translation
                            </Badge>
                          )}
                          {backup.formData.summary && (
                            <Badge variant="secondary" className="text-xs">
                              ✓ Summary
                            </Badge>
                          )}
                          {backup.formData.isManualTranscript && (
                            <Badge variant="outline" className="text-xs">
                              Manual Transcript
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {backup.formData?.transcription && (
                      <div>
                        <strong className="text-sm">Transcription Preview:</strong>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                          {backup.formData.transcription}
                        </p>
                      </div>
                    )}
                    
                    {backup.formData?.translation && (
                      <div>
                        <strong className="text-sm">Translation Preview:</strong>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                          {backup.formData.translation}
                        </p>
                      </div>
                    )}
                    
                    {backup.formData?.summary && (
                      <div>
                        <strong className="text-sm">Summary Preview:</strong>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                          {backup.formData.summary}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No backup data found
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
