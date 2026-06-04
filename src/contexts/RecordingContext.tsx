"use client";

import { createContext, useContext, useState, ReactNode } from 'react';

interface RecordingContextType {
    isRecording: boolean;
    setIsRecording: (recording: boolean) => void;
}

const RecordingContext = createContext<RecordingContextType | undefined>(undefined);

export const RecordingProvider = ({ children }: { children: ReactNode }) => {
    const [isRecording, setIsRecording] = useState(false);

    return (
        <RecordingContext.Provider value={{ isRecording, setIsRecording }}>
            {children}
        </RecordingContext.Provider>
    );
};

export const useRecording = () => {
    const context = useContext(RecordingContext);
    if (context === undefined) {
        throw new Error('useRecording must be used within a RecordingProvider');
    }
    return context;
};
