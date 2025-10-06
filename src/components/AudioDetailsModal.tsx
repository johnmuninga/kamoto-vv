/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AudioRecord, SUPPORTED_LANGUAGES } from "@/lib/types";
import { Volume2, FileText, Languages, Loader2, Save, Download } from "lucide-react";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { toast } from "sonner";

interface AudioDetailsModalProps {
  record: AudioRecord;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function AudioDetailsModal({
  record,
  isOpen,
  onClose,
  onUpdate,
}: AudioDetailsModalProps) {
  const [transcript, setTranscript] = useState(record.transcription || "");
  const [summary, setSummary] = useState(record.summary || "");
  const [translatedText, setTranslatedText] = useState(record.translate_to_english || "");
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedCloseDialog, setShowUnsavedCloseDialog] = useState(false);

  useEffect(() => {
    setTranscript(record.transcription || "");
    setSummary(record.summary || "");
    setTranslatedText(record.translate_to_english || "");
    setHasUnsavedChanges(false);
  }, [record]);

  const isLanguageSupported = (language: string | null) => {
    if (!language) return false;
    return SUPPORTED_LANGUAGES.includes(language as any);
  };

  // const handlereTranscribe = useCallback(async () => {
  //   const blob = recordedAudio || record.url;
  //   if (!blob) return;
  
  //   setIsTranscribing(true);
  //   try {
  //     const fd = new FormData();
  //     fd.append("file", blob, "upload.webm");
  
  //     const res = await fetch("/api/audio/transcribe", {
  //       method: "POST",
  //       body: fd,
  //     });
  //     if (!res.ok) throw new Error(await res.text());
  
  //     const { transcription } = await res.json();
  //     setTranscript(transcription);
  //     toast.success("Transcribed!");
  //   } catch (err) {
  //     console.error("Transcription failed:", err);
  //     toast.error("Transcription failed.");
  //   } finally {
  //     setIsTranscribing(false);
  //   }
  // }, [recordedAudio, record.url]);
  

  const downloadText = (text: string, filename: string, type: 'transcript' | 'summary' | 'translation') => {
    if (!text.trim()) {
      toast.error(`No ${type} available to download`);
      return;
    }

    try {
      // Create a formatted text content
      const header = `Community Engagement ${type.charAt(0).toUpperCase() + type.slice(1)}\n`;
      const separator = "=".repeat(50) + "\n\n";
      const metadata = `Recording Name: ${record.recording_name || 'Untitled'}\n`;
      const communityInfo = `Community: ${record.community || 'N/A'}\n`;
      const languageInfo = `Language: ${record.engagement_language || 'N/A'}\n`;
      const socialWorkerInfo = `Social Worker: ${record.social_worker_name || 'N/A'}\n`;
      const dateInfo = `Engagement Date: ${record.engagement_date || 'N/A'}\n\n`;
      
      const content = header + separator + 
        metadata + communityInfo + languageInfo + socialWorkerInfo + 
        dateInfo + 
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
    const filename = (record.recording_name || 'transcript').replace(/[^a-zA-Z0-9]/g, '_');
    downloadText(transcript, filename, 'transcript');
  };

  const downloadTranslation = () => {
    const filename = (record.recording_name || 'translation').replace(/[^a-zA-Z0-9]/g, '_');
    downloadText(translatedText, filename, 'translation');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/audio/update/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription: transcript,
          summary,
          translate_to_english: translatedText,
        }),
      });

      if (!response.ok) throw new Error('Failed to update record');

      toast.success("Record updated successfully!");
      onUpdate();
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error updating record:', error);
      toast.error("Failed to update record. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };


  const downloadSummary = () => {
    const filename = (record.recording_name || 'summary').replace(/[^a-zA-Z0-9]/g, '_');
    downloadText(summary, filename, 'summary');
  };
  

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedCloseDialog(true);
    } else {
      onClose();
    }
  };
  const confirmCloseWithoutSaving = () => {
    setShowUnsavedCloseDialog(false);
    onClose();
  };

  const getLanguageBadge = () => {
    const language = record.engagement_language;
    if (!language) return null;
    if (record.language_supported === false || !isLanguageSupported(language)) {
      return <Badge variant="destructive">{language} (Unsupported)</Badge>;
    }
    return <Badge variant="secondary">{language}</Badge>;
  };

  

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="min-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {record.recording_name || 'Untitled Recording'}
          </DialogTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>ID: #{record.id}</span>
            <span>Community: {record.community}</span>
            <span>Date: {record.engagement_date}</span>
            {getLanguageBadge()}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {record.url && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Volume2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Audio Playback</span>
                </div>
                <audio controls className="w-full">
                  <source src={record.url} type="audio/webm" />
                  <source src={record.url} type="audio/mp3" />
                  Your browser does not support the audio element.
                </audio>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="transcript" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="transcript" className="gap-2">
                <FileText className="h-4 w-4" />
                Transcript
              </TabsTrigger>
              <TabsTrigger value="translated" className="gap-2">
                <Languages className="h-4 w-4" />
                Translated
              </TabsTrigger>
              <TabsTrigger value="summary" className="gap-2">
                <FileText className="h-4 w-4" />
                Summary
              </TabsTrigger>
            </TabsList>

            <TabsContent value="transcript" className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {transcript ? "Transcription completed automatically" : "No transcription available"}
                </div>
                {transcript && (
                  <Button
                    onClick={downloadTranscript}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Transcript
                  </Button>
                )}
              </div>

              <Textarea
                placeholder="Transcription will appear here..."
                value={transcript}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                className="min-h-[300px] font-mono text-sm"
              />
            </TabsContent>

            <TabsContent value="translated" className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {translatedText ? "Translation completed automatically" : "No translation available"}
                </div>
                {translatedText && (
                  <Button
                    onClick={downloadTranslation}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Translation
                  </Button>
                )}
              </div>
              <Textarea
                placeholder="Translated text will appear here..."
                value={translatedText}
                readOnly
                className="min-h-[300px] font-mono text-sm bg-muted"
              />
            </TabsContent>

            <TabsContent value="summary" className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {summary ? "Summary generated automatically" : "No summary available"}
                </div>
                {summary.trim() && (
                  <Button
                    onClick={downloadSummary}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Summary
                  </Button>
                )}
              </div>
              <Textarea
                placeholder="Summary will appear here..."
                value={summary}
                onChange={(e) => {
                  setSummary(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                className="min-h-[300px] font-mono text-sm"
              />
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={showUnsavedCloseDialog} onOpenChange={setShowUnsavedCloseDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">
          You have unsaved changes. Are you sure you want to close without saving?
        </p>
        <AlertDialogFooter className="flex justify-end gap-2 pt-4">
          <AlertDialogCancel asChild>
            <Button variant="outline">Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button className="bg-destructive text-white" onClick={confirmCloseWithoutSaving}>
              Close Without Saving
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

  </>
  );
}
