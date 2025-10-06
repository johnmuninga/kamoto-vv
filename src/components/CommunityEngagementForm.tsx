"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EngagementDialog from "./EngagementDialog";
import { EngagementProvider } from "@/contexts/EngagementContext";

import { Users, FileAudio, Calendar } from "lucide-react";
import Link from "next/link";

export default function CommunityEngagementForm() {
  const [socialWorkerName, setSocialWorkerName] = useState("Thom "); 
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    
    const updateDate = () => {
      setCurrentDate(format(new Date(), "PPP")); 
    };
    
    updateDate();
    const interval = setInterval(updateDate, 60000); 
    
    return () => clearInterval(interval);
  }, []);

  const handleCreateRecord = () => {
    setIsDialogOpen(true);
  };

  return (
    <EngagementProvider 
      socialWorkerName={socialWorkerName} 
      engagementDate={format(new Date(), "yyyy-MM-dd")}
    >
      <div className="min-h-screen w-full bg-gradient-to-br from-background to-muted/30 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Top Bar with Social Worker Name and Date */}
          <div className="flex justify-between items-center py-4 px-6 bg-card rounded-lg border shadow-sm">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#FFC107]" />
              <span className="font-medium text-foreground">
                Social Worker: <span className="text-primary font-semibold">{socialWorkerName}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#FFC107]" />
              <span className="font-medium text-foreground">
                {currentDate}
              </span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center space-y-2 py-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <FileAudio className="h-10 w-10  text-[#FFC107]" />
              <h1 className="text-4xl font-bold text-[#1E293B]">
                COMMUNITY ENGAGEMENT FORM
              </h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Record and manage community engagement sessions across Kolwezi, DRC
            </p>
          </div>

          {/* Navigation */}
          <div className="flex justify-center gap-4 mb-8">
            <Button variant="default" className="gap-2 bg-[#FFC107] text-[#1E293B] hover:bg-[#e6b800] transition-colors">
              <FileAudio className="h-4 w-4" />
              New Meeting
            </Button>
            <Link href="/dashboard">
              <Button variant="outline" className="gap-2 ">
                View Dashboard
              </Button>
            </Link>
          </div>

          {/* Main Action Card */}
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                <FileAudio className="h-6 w-6 text-[#FFC107]" />
                Ready to Create New Meeting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  All information is ready. Click below to start creating your community engagement record.
                </p>
                
                <div className="flex items-center justify-center gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <Users className="h-6 w-6 text-[#FFC107] mx-auto mb-1" />
                    <p className="text-sm font-medium">{socialWorkerName}</p>
                    <p className="text-xs text-muted-foreground">Social Worker</p>
                  </div>
                  <div className="h-12 w-px bg-border"></div>
                  <div className="text-center">
                    <Calendar className="h-6 w-6 text-[#FFC107] mx-auto mb-1" />
                    <p className="text-sm font-medium">{format(new Date(), "dd/MM/yyyy")}</p>
                    <p className="text-xs text-muted-foreground">Today's Date</p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleCreateRecord}
                size="lg"
                className="w-full text-lg py-6 bg-[#FFC107] text-[#1E293B] hover:bg-[#e6b800] transition-colors"
              >
                <FileAudio className="h-5 w-5 mr-2" />
                Create New Meeting
              </Button>
            </CardContent>
          </Card>

          {/* Features Info */}
          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto mt-12">
            <Card>
              <CardContent className="p-6 text-center">
                <FileAudio className="h-8 w-8 text-[#FFC107] mx-auto mb-2" />
                <h3 className="font-semibold mb-2">Audio Recording</h3>
                <p className="text-sm text-muted-foreground">
                  Record live audio or upload existing files
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="h-8 w-8 text-[#FFC107] mx-auto mb-2 " />
                <h3 className="font-semibold mb-2">Community Focus</h3>
                <p className="text-sm text-muted-foreground">
                  Track engagement across Kolwezi communities
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <Calendar className="h-8 w-8 text-[#FFC107] mx-auto mb-2" />
                <h3 className="font-semibold mb-2">Smart Transcription</h3>
                <p className="text-sm text-muted-foreground">
                  AI-powered transcription in local languages
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <EngagementDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        socialWorkerName={socialWorkerName}
        engagementDate={format(new Date(), "yyyy-MM-dd")}
      />
    </EngagementProvider>
  );
}