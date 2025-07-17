/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AudioRecord, SUPPORTED_LANGUAGES } from "@/lib/types";
import AudioDetailsModal from "@/components/AudioDetailsModal";
import { ArrowLeft, FileAudio, Eye, Users, Calendar, Languages } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function Dashboard() {
  const [records, setRecords] = useState<AudioRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<AudioRecord | null>(null);

  

  const fetchRecords = async () => {
    try {
      const response = await fetch('/api/audio/list');
      if (!response.ok) {
        throw new Error('Failed to fetch records');
      }
      const data = await response.json();
      setRecords(data.records || []);
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error("Failed to load records");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchRecords();
  }, []);

  const handleViewRecord = (record: AudioRecord) => {
    setSelectedRecord(record);
  };

  const isLanguageSupported = (language: string | null) => {
    if (!language) return false;
    return SUPPORTED_LANGUAGES.includes(language as any);
  };

  const getLanguageBadge = (language: string | null, supported: boolean | null) => {
    if (!language) return null;
    
    if (supported === false || !isLanguageSupported(language)) {
      return (
        <Badge variant="destructive" className="text-xs">
          {language} (Unsupported)
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary" className="text-xs">
        {language}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="text-center">
          <FileAudio className="h-12 w-12 text-[#FFC107] mx-auto mb-4 animate-pulse" />
          <p className="text-lg text-muted-foreground">Loading records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 p-4">
      <div className="w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Form
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-8 w-8 text-[#FFC107]" />
              Community Engagement Dashboard
            </h1>
            <p className="text-muted-foreground">
              Manage and view all community engagement records
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileAudio className="h-5 w-5 text-[#FFC107]" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Records</p>
                  <p className="text-2xl font-bold">{records.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-green-500 " />
                <div>
                  <p className="text-sm text-muted-foreground">Translated Languages</p>
                  <p className="text-2xl font-bold">
                    {records.filter(r => r.language_supported === true).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-info text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Communities</p>
                  <p className="text-2xl font-bold">
                    {new Set(records.map(r => r.community).filter(Boolean)).size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-warning text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-2xl font-bold">
                    {records.filter(r => {
                      if (!r.engagement_date) return false;
                      const recordDate = new Date(r.engagement_date);
                      const now = new Date();
                      return recordDate.getMonth() === now.getMonth() && 
                             recordDate.getFullYear() === now.getFullYear();
                    }).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Records Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Engagement Records</CardTitle>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="text-center py-8">
                <FileAudio className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">No records found</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first engagement record to get started
                </p>
                <Link href="/">
                  <Button className="gap-2 bg-[#FFC107] text-[#1E293B] hover:bg-[#e6b800] transition-colors">
                    <FileAudio className="h-4 w-4" />
                    Create Record
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Recording Name</TableHead>
                      <TableHead>Community</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>Social Worker</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record, key) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-mono text-sm">
                          #{key + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {record.recording_name || 'Untitled'}
                        </TableCell>
                        <TableCell>{record.community || 'N/A'}</TableCell>
                        <TableCell>
                          {record.engagement_date 
                            ? format(new Date(record.engagement_date), 'dd MMM yyyy')
                            : 'N/A'
                          }
                        </TableCell>
                        <TableCell>
                          {getLanguageBadge(record.engagement_language, record.language_supported)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.social_worker_name || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewRecord(record)}
                            className="gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedRecord && (
        <AudioDetailsModal
          record={selectedRecord}
          isOpen={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onUpdate={fetchRecords}
        />
      )}
    </div>
  );
}