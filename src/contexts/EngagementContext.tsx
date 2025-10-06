'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface EngagementData {
  recordingName: string
  community: string
  language: string
  socialWorkerName: string
  engagementDate: string
  transcription: string
  translation: string
  summary: string
  isManualTranscript: boolean
  recordingTime: number
  audioFile: File | null
  recordedAudio: Blob | null
  audioUrl: string | null
  backupKey: string | null
  isBackedUp: boolean
  isTranscribing: boolean
  isProcessing: boolean
  didTranscribe: boolean
}

interface EngagementContextType {
  data: EngagementData
  updateData: (updates: Partial<EngagementData>) => void
  resetData: () => void
  recoverData: (backupData: any) => void
  isRecovering: boolean
  setIsRecovering: (recovering: boolean) => void
}

const initialData: EngagementData = {
  recordingName: '',
  community: '',
  language: '',
  socialWorkerName: '',
  engagementDate: '',
  transcription: '',
  translation: '',
  summary: '',
  isManualTranscript: false,
  recordingTime: 0,
  audioFile: null,
  recordedAudio: null,
  audioUrl: null,
  backupKey: null,
  isBackedUp: false,
  isTranscribing: false,
  isProcessing: false,
  didTranscribe: false,
}

const EngagementContext = createContext<EngagementContextType | undefined>(undefined)

export const useEngagement = () => {
  const context = useContext(EngagementContext)
  if (!context) {
    throw new Error('useEngagement must be used within an EngagementProvider')
  }
  return context
}

interface EngagementProviderProps {
  children: ReactNode
  socialWorkerName: string
  engagementDate: string
}

export const EngagementProvider: React.FC<EngagementProviderProps> = ({
  children,
  socialWorkerName,
  engagementDate,
}) => {
  const [data, setData] = useState<EngagementData>({
    ...initialData,
    socialWorkerName,
    engagementDate,
  })
  const [isRecovering, setIsRecovering] = useState(false)

  const updateData = useCallback((updates: Partial<EngagementData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }, [])

  const resetData = useCallback(() => {
    setData({
      ...initialData,
      socialWorkerName,
      engagementDate,
    })
  }, [socialWorkerName, engagementDate])

  const recoverData = useCallback((backupData: any) => {
    console.log('Context: Recovering data from backup:', backupData)
    setIsRecovering(true)
    
    // Clear existing data first
    setData(prev => ({
      ...prev,
      recordingName: '',
      community: '',
      language: '',
      transcription: '',
      translation: '',
      summary: '',
      isManualTranscript: false,
      recordingTime: 0,
      audioFile: null,
      recordedAudio: null,
      audioUrl: null,
      isTranscribing: false,
      isProcessing: false,
      didTranscribe: false,
    }))

    // Use setTimeout to ensure state updates are processed
    setTimeout(() => {
      console.log('Context: Setting recovered data:', backupData)
      
      setData(prev => ({
        ...prev,
        recordingName: backupData.recordingName || '',
        community: backupData.community || '',
        language: backupData.language || '',
        transcription: backupData.transcription || '',
        translation: backupData.translation || '',
        summary: backupData.summary || '',
        recordingTime: backupData.recordingTime || 0,
        isManualTranscript: backupData.isManualTranscript || false,
        didTranscribe: !!backupData.transcription,
        backupKey: backupData.key || null,
        isBackedUp: !!backupData.key,
      }))
      
      setIsRecovering(false)
      console.log('Context: Data recovery completed')
    }, 100)
  }, [])

  const value: EngagementContextType = {
    data,
    updateData,
    resetData,
    recoverData,
    isRecovering,
    setIsRecovering,
  }

  return (
    <EngagementContext.Provider value={value}>
      {children}
    </EngagementContext.Provider>
  )
}
