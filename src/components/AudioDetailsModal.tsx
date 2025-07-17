/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AudioRecord, SUPPORTED_LANGUAGES } from "@/lib/types";
import { Volume2, FileText, RotateCcw, Languages, Loader2, Save, Download } from "lucide-react";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { toast } from "sonner";
import jsPDF from "jspdf";

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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
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

  const handleRetranscribe = async () => {
    if (!record.url) {
      toast.error("No audio file found for transcription");
      return;
    }

    setIsTranscribing(true);
    try {
      const response = await fetch('/api/audio/transcribe-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: record.url, audioId: record.id }),
      });

      if (!response.ok) throw new Error('Failed to transcribe audio');

      const data = await response.json();
      setTranscript(data.transcription);
      setHasUnsavedChanges(true);
      toast.success("Audio transcribed successfully!");
    } catch (error) {
      console.error('Error transcribing audio:', error);
      toast.error("Failed to transcribe audio. Please try again.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleTranslate = async () => {
    if (!transcript.trim()) {
      toast.error("No transcript available to translate");
      return;
    }

    setIsTranslating(true);
    try {
      const response = await fetch('/api/audio/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcript,
          sourceLanguage: record.engagement_language || 'auto'
        }),
      });

      if (!response.ok) throw new Error('Failed to translate text');

      const data = await response.json();
      setTranslatedText(data.translatedText);
      setHasUnsavedChanges(true);
      toast.success("Text translated to English successfully!");
    } catch (error) {
      console.error('Error translating text:', error);
      toast.error("Failed to translate text. Please try again.");
    } finally {
      setIsTranslating(false);
    }
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


  const handleGenerateSummary = async () => {
    if (!translatedText.trim()) {
      toast.error("No transcript available to summarize");
      return;
    }
    setIsSummarizing(true);
  
    try {
      const response = await fetch('/api/audio/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translatedText }),
      });
  
      if (!response.ok) throw new Error("Failed to generate summary");
  
      const data = await response.json();
      setSummary(data.summary);
      setHasUnsavedChanges(true);
      toast.success("Summary generated successfully!");
    } catch (error) {
      console.error("Summary generation failed:", error);
      toast.error("Failed to generate summary.");
    }finally {
      setIsSummarizing(false);
    }

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

  function handleDownloadSummary() {
    if (!summary.trim()) {
      toast.error("No summary to download.");
      return;
    }
  
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
  
    
    doc.setFont("helvetica", "bold")
       .setFontSize(18)
       .setTextColor("#2c3e50")
       .text("ENGAGEMENT SUMMARY", margin + pageWidth / 2, 60, { align: "center" });
  
    doc.setFont("helvetica", "normal")
       .setFontSize(12)
       .setTextColor("#4a4a4a")
       .text(`Social Worker: ${record.social_worker_name}`, margin, 90)
       .text(`Community: ${record.community}`, margin, 110)
       .text(`Date: ${record.engagement_date}`, margin, 130);
  
    
    doc.setDrawColor("#bdc3c7")
       .setLineWidth(0.5)
       .line(margin, 140, margin + pageWidth, 140);
  
    
    doc.setFont("helvetica", "normal")
       .setFontSize(12)
       .setTextColor("#333");
    const lines = doc.splitTextToSize(summary, pageWidth);
    doc.text(lines, margin, 160);
  
    
    const now = new Date().toLocaleString();
    doc.setFontSize(8)
       .setTextColor("#999")
       .text(`Generated on ${now}`, margin, doc.internal.pageSize.getHeight() - 30);
  
    // Save
    doc.save(`Engagement_Summary_${record.id}.pdf`);
    toast.success("Summary downloaded!");
  }
  

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
              <div className="flex gap-2">
                {/* <Button
                  onClick={handleRetranscribe}
                  disabled={isTranscribing || !record.url}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Transcribing...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4" />
                      Retranscribe
                    </>
                  )}
                </Button> */}
                <Button
                  onClick={handleTranslate}
                  disabled={isTranslating || !transcript.trim()}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  {isTranslating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Translating...
                    </>
                  ) : (
                    <>
                      <Languages className="h-4 w-4" />
                      Translate to English
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleGenerateSummary}
                  disabled={!translatedText.trim()}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  {
                    isSummarizing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Summarizing...
                      </>
                    ) : (
                      <>
                      <FileText className="h-4 w-4" />
                      Generate Summary
                      </>
                    )
                  }
                </Button>

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
              <Textarea
                placeholder="Translated text will appear here..."
                value={translatedText}
                readOnly
                className="min-h-[300px] font-mono text-sm bg-muted"
              />
            </TabsContent>

            <TabsContent value="summary" className="space-y-4">
            {summary.trim() && (
              <Button
                onClick={handleDownloadSummary}
                variant="secondary"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download Summary
              </Button>
            )}
              <Textarea
                placeholder="Enter a summary of the engagement session..."
                value={summary}
                onChange={(e) => {
                  setSummary(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                className="min-h-[300px] font-mono text-sm bg-muted"
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
