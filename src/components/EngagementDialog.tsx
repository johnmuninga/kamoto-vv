'use client'

import { useState, useRef, useEffect, useCallback } from "react"
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
import { SOUTH_AFRICAN_PROVINCES, SUPPORTED_LANGUAGES, ALL_LANGUAGES } from "@/lib/types"
import { toast } from "sonner"
import { Textarea } from "./ui/textarea"
import { supabaseBrowserClient } from "@/lib/supabaseClient"


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
  const [didTranscribe, setDidTranscribe] = useState(false)
  const [isManualTranscript, setIsManualTranscript] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".webm"] },
    maxSize: 50 * 1024 * 1024,
    onDrop: (files) => {
      const f = files[0]
      setAudioFile(f)
      setRecordedAudio(null)
      setAudioUrl(URL.createObjectURL(f))
      toast.success("Audio file uploaded.")
    },
    onDropRejected: () => {
      toast.error("Invalid file. Max 50MB audio only.")
    },
  })

  const isLangUnsupported = (lang: any) => !SUPPORTED_LANGUAGES.includes(lang);

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
  
  useEffect(() => {
    return () => {
      intervalRef.current?.unref && intervalRef.current.unref()
      clearInterval(intervalRef.current!)
      cancelAnimationFrame(animationRef.current)
      audioCtxRef.current?.close()
    }
  }, [])

  
  const handleTranscribe = useCallback(async () => {
    const blob = recordedAudio || audioFile
    if (!blob || isManualTranscript) return

    setIsTranscribing(true)
    try {
      const fd = new FormData()
      fd.append("file", blob, "temp.webm")
      fd.append("model_id", "scribe_v1")

      const res = await fetch(
        "https://api.elevenlabs.io/v1/speech-to-text",
        {
          method: "POST",
          headers: {
            "xi-api-key":
              process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ?? "",
          },
          body: fd,
        }
      )
      if (!res.ok) throw new Error(res.statusText)
      const json = await res.json()
      setTranscription(json.text || "")
      toast.success("Transcribed!")
    } catch {
      toast.error("Transcription failed.")
    } finally {
      setIsTranscribing(false)
    }
  }, [audioFile, recordedAudio, isManualTranscript])

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

      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      ctx.createMediaStreamSource(stream).connect(analyser)

      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data)
      }
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        setRecordedAudio(blob)
        setAudioFile(null)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
        clearInterval(intervalRef.current!)
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
      setRecordingTime(0)
      intervalRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1)
      }, 1000)
      drawWaveform()
      toast.success("Recording started.")
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

  
  async function handleSave() {
    if (!recordingName || !community || !language || !transcription || !(recordedAudio || audioFile)) {
      return toast.error("Fill all fields and transcribe first.")
    }
  
    setIsLoading(true)
    try {
      const blob = recordedAudio || audioFile!
      const timestamp = Date.now()
      const safeName = recordingName.replace(/[^a-z0-9]/gi, "_")
      const filename = `${timestamp}-${safeName}.webm`
  
      
      const { error: uploadError } = await supabaseBrowserClient
        .storage
        .from("audios")
        .upload(filename, blob, {
          contentType: blob.type,
          upsert: false,
        })
      if (uploadError) throw uploadError
  
      
      const { data: urlData } = supabaseBrowserClient
        .storage
        .from("audios")
        .getPublicUrl(filename)
      const publicUrl = urlData.publicUrl
  
      
      const res = await fetch("/api/audio/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: publicUrl,
          type: blob.type,
          socialWorkerName,
          engagementDate,
          recordingName,
          community,
          language,
          transcription,
        }),
      })
      if (!res.ok) throw new Error("metadata save failed")
  
      toast.success("Record saved!")
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error("Save failed: " + err.message)
    } finally {
      setIsLoading(false)
    }
  }
  

  useEffect(() => {
    if (language && isLangUnsupported(language)) {
      setIsManualError(true);
    } else {
      setIsManualError(false);
    }
  }, [language]);
  

  
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
                  {SOUTH_AFRICAN_PROVINCES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
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
                {ALL_LANGUAGES.map((l) => (
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
