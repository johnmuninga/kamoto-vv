'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useDropzone } from "react-dropzone"
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
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import {
  Mic,
  MicOff,
  Upload,
  Volume2,
  Loader2,
  Trash,
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
  const [recordingName, setRecordingName] = useState("")
  const [community, setCommunity] = useState("")
  const [language, setLanguage] = useState("")
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isManualError, setIsManualError] = useState(false)

  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  const [transcription, setTranscription] = useState("")
  const [isTranscribing, setIsTranscribing] = useState(false)

  const [isLoading, setIsLoading] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const backupIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [didTranscribe, setDidTranscribe] = useState(false)
  const [isManualTranscript, setIsManualTranscript] = useState(false);
  const [isBackedUp, setIsBackedUp] = useState(false);
  const [backupKey, setBackupKey] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".webm"] },
    maxSize: 50 * 1024 * 1024,
    onDrop: async (files) => {
      const f = files[0]
      setAudioFile(f)
      setRecordedAudio(null)
      setAudioUrl(URL.createObjectURL(f))
      
      // Backup uploaded file
      const newBackupKey = generateBackupKey();
      setBackupKey(newBackupKey);
      await saveAudioToLocalStorage(f, newBackupKey);
      
      toast.success("Audio file uploaded and backed up.")
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

  const saveAudioToLocalStorage = async (audioBlob: Blob, key: string) => {
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
        base64 += btoa(String.fromCharCode(...chunk));
      }
      
      const backupData = {
        audioData: base64,
        timestamp: Date.now(),
        type: audioBlob.type,
        size: audioBlob.size
      };
      
      localStorage.setItem(key, JSON.stringify(backupData));
      setIsBackedUp(true);
      toast.success("Audio backed up locally", { duration: 2000 });
    } catch (error) {
      console.error("Failed to backup audio:", error);
      toast.error("Failed to backup audio locally");
    }
  };

  const loadAudioFromLocalStorage = (key: string): Blob | null => {
    try {
      const backupData = localStorage.getItem(key);
      if (!backupData) return null;
      
      const { audioData, type } = JSON.parse(backupData);
      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      
      // Convert binary string to bytes
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return new Blob([bytes], { type });
    } catch (error) {
      console.error("Failed to load audio from backup:", error);
      return null;
    }
  };

  const clearAudioBackup = (key: string) => {
    try {
      localStorage.removeItem(key);
      setIsBackedUp(false);
    } catch (error) {
      console.error("Failed to clear audio backup:", error);
    }
  };

  const handleLanguageChange = (val: any) => {
    setLanguage(val);
    const unsupported = isLangUnsupported(val);
    setIsManualTranscript(unsupported);
    if (unsupported) {
      setIsManualError(true);
      setTranscription("");
      toast.warning("This language is unsupported. Please enter the transcript manually.");
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
    const blob = recordedAudio || audioFile;
    if (!blob || isManualTranscript) return;
  
    setIsTranscribing(true);
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
      setTranscription(json.transcription || "");
      toast.success("Transcribed successfully!");
    } catch (err) {
      console.error("Transcription failed:", err);
      toast.error("Transcription failed. Please try manual transcription.");
    } finally {
      setIsTranscribing(false);
    }
  }, [audioFile, recordedAudio, isManualTranscript]);
  

  useEffect(() => {
    if (audioUrl && !didTranscribe && !isManualTranscript) {
      setDidTranscribe(true)
      handleTranscribe()
    }
  }, [audioUrl, didTranscribe, isManualTranscript, handleTranscribe])

 
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      // Generate backup key for this recording session
      const newBackupKey = generateBackupKey();
      setBackupKey(newBackupKey);

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
        setRecordedAudio(blob)
        setAudioFile(null)
        setAudioUrl(URL.createObjectURL(blob))
        
        // Final backup of complete recording
        await saveAudioToLocalStorage(blob, newBackupKey);
        
        stream.getTracks().forEach((t) => t.stop())
        clearInterval(intervalRef.current!)
      }

      mediaRecorderRef.current.start(10000) // Start with 10-second intervals
      setIsRecording(true)
      setRecordingTime(0)
      
      // Timer for recording duration
      intervalRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1)
      }, 1000)
      
      // Periodic backup every 30 seconds during recording
      backupIntervalRef.current = setInterval(async () => {
        if (audioChunksRef.current.length > 0) {
          const tempBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          await saveAudioToLocalStorage(tempBlob, newBackupKey);
        }
      }, 30000) // Backup every 30 seconds
      
      drawWaveform()
      toast.success("Recording started with auto-backup enabled.")
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
      
      toast.success("Recording stopped.")
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
      !recordingName ||
      !community ||
      !language ||
      !transcription ||
      !(recordedAudio || audioFile)
    ) {
      return toast.error("Fill all fields and transcribe first.");
    }
  
    setIsLoading(true);
    try {
      // 1) Read the blob as base64
      const blob = recordedAudio || audioFile!;
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(blob);
      });
  
      // 2) POST it
      const payload = {
        audioData: base64,
        socialWorkerName,
        engagementDate,
        recordingName,
        community,
        language,
        transcription,
      };
      
      // Show progress toast
      toast.loading("Saving meeting and processing translation...", { id: "save-progress" });
      
      const res = await fetch("/api/audio/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save failed");
  
      const data = await res.json();
      
      // Update progress toast
      toast.loading("Generating summary...", { id: "save-progress" });
      
      // Wait a moment to show the summary step
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clear backup after successful save
      if (backupKey) {
        clearAudioBackup(backupKey);
      }
      
      toast.dismiss("save-progress");
      toast.success("Meeting saved with automatic translation and summary!");
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
    if (language && isLangUnsupported(language)) {
      setIsManualError(true);
    } else {
      setIsManualError(false);
    }
  }, [language]);

  // Check for existing audio backup on component mount
  useEffect(() => {
    if (isOpen) {
      // Look for any existing audio backup
      const keys = Object.keys(localStorage).filter(key => key.startsWith('audio_backup_'));
      if (keys.length > 0) {
        // Get the most recent backup
        const mostRecentKey = keys.sort().pop()!;
        const backupData = localStorage.getItem(mostRecentKey);
        if (backupData) {
          const { timestamp } = JSON.parse(backupData);
          const ageInMinutes = (Date.now() - timestamp) / (1000 * 60);
          
          if (ageInMinutes < 60) { // Only offer recovery if backup is less than 1 hour old
            toast.info("Found a recent audio backup. Would you like to recover it?", {
              duration: 10000,
              action: {
                label: "Recover",
                onClick: () => {
                  const recoveredBlob = loadAudioFromLocalStorage(mostRecentKey);
                  if (recoveredBlob) {
                    setRecordedAudio(recoveredBlob);
                    setAudioFile(null);
                    setAudioUrl(URL.createObjectURL(recoveredBlob));
                    setBackupKey(mostRecentKey);
                    setIsBackedUp(true);
                    toast.success("Audio recovered from backup!");
                  }
                }
              }
            });
          }
        }
      }
    }
  }, [isOpen]);
  

  
  useEffect(() => {
    if (!isOpen) {
      setIsTranscribing(false)
      setIsTranscribing(false)
      setRecordingName("")
      setCommunity("")
      setLanguage("")
      setAudioFile(null)
      setRecordedAudio(null)
      setAudioUrl(null)
      setTranscription("")
      setRecordingTime(0)
      setIsBackedUp(false)
      setBackupKey(null)
      
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

          {/* Form Fields */}
          <div className="grid md:grid-cols-2 w-full gap-4">
            <div className="space-y-2">
              <Label>Recording Name *</Label>
              <Input
                value={recordingName}
                onChange={(e) => setRecordingName(e.target.value)}
                placeholder="Please enter a name for the recording"
              />
            </div>
            <div className="space-y-2">
              <Label>Community *</Label>
              <Select
                value={community}
                onValueChange={setCommunity}

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
                value={language}
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
                    disabled={!isRecording && (!recordingName || !community || !language)}
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
                        <span>{formatTime(recordingTime)}</span>
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
                  {!isRecording && (recordedAudio || audioFile) && (
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      {isBackedUp ? (
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
                  {!isRecording && (!recordingName || !community || !language) && (
                    <div className="text-xs text-muted-foreground text-center">
                      <p>Please fill in Recording Name, Community, and Language to start recording</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview + Auto-Transcript */}
            {audioUrl && (
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 /><span>Audio Preview</span>
                  </div>
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
                            setAudioUrl(null);
                            setAudioFile(null);
                            setRecordedAudio(null);
                            setDidTranscribe(false);
                            setTranscription("");
                            toast.info("Audio removed.");
                          }}
                        >
                          Yes, remove audio
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <audio controls src={audioUrl} className="w-full" />

                {isManualTranscript ? (
                  <div className="space-y-2">
                    <Label>Manual Transcription *</Label>
                    {isManualError && (
                      <p className="text-red-500 text-sm">
                        This language is currently not supported by our transcription system. Please enter the transcription manually in the field below.
                      </p>
                    )}
                    <Textarea
                      value={transcription}
                      onChange={(e) => setTranscription(e.target.value)}
                      placeholder="Please type the transcript manually here..."
                      className="min-h-[200px]"
                    />
                  </div>
                ) : (
                  <>
                    {isTranscribing && (
                      <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="animate-spin" />
                        <span>Transcribing…</span>
                      </div>
                    )}
                    {transcription && (
                      <Textarea
                        readOnly
                        value={transcription}
                        className="w-full h-80 border rounded p-2"
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}


          {/* Actions */}
          <div className="flex justify-end gap-2">
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
              disabled={!transcription || isLoading}
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
      </DialogContent>
    </Dialog>
  )
}
