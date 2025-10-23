import React, { useState, useRef, useCallback, useEffect } from 'react';
// FIX: Removed `LiveSession` as it's not an exported member of '@google/genai'.
// FIX: Import `Blob` type for use in the local `LiveSession` interface.
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Speaker, TranscriptEntry } from './types';
import { createBlob, decode, decodeAudioData, blobToBase64 } from './services/audioUtils';
import TranscriptView from './components/TranscriptView';
import StatusIndicator from './components/StatusIndicator';
import { MicrophoneIcon, StopIcon, PaperclipIcon, PencilIcon } from './components/Icons';
import PinScreen from './components/PinScreen';
import DrawingPad from './components/DrawingPad';

// FIX: Defined a local `LiveSession` interface for type safety.
interface LiveSession {
  // FIX: Used the imported `Blob` type for `media` to match the SDK's expected input type,
  // resolving the type mismatch where `data` is optional.
  sendRealtimeInput(input: { media: Blob }): void;
  close(): void;
}

const SYSTEM_INSTRUCTION = `You are a friendly and encouraging Socratic math tutor for a high school student. Your goal is to help the student understand concepts and solve problems by asking guiding questions, especially based on the image they provide. Never give the direct answer. Instead, break down the problem and ask questions that lead the student to discover the solution themselves. Keep your responses concise, conversational, and easy to understand.`;

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isDrawingPadOpen, setIsDrawingPadOpen] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'LISTENING' | 'THINKING' | 'SPEAKING'>('IDLE');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userTranscriptionRef = useRef('');
  const modelTranscriptionRef = useRef('');
  
  const audioPlaybackQueueRef = useRef<{ buffer: AudioBuffer; startTime: number }[]>([]);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const processAudioPlayback = useCallback(() => {
    if (!outputAudioContextRef.current) return;
  
    while (audioPlaybackQueueRef.current.length > 0) {
      const { buffer, startTime } = audioPlaybackQueueRef.current.shift()!;
      const source = outputAudioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(outputAudioContextRef.current.destination);
      
      const endedListener = () => {
        audioSourcesRef.current.delete(source);
        source.removeEventListener('ended', endedListener);
      };
      source.addEventListener('ended', endedListener);
      
      source.start(startTime);
      audioSourcesRef.current.add(source);
    }
  }, []);

  const stopAllPlayback = useCallback(() => {
    audioSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        console.warn("Failed to stop audio source:", e);
      }
    });
    audioSourcesRef.current.clear();
    audioPlaybackQueueRef.current = [];
    nextStartTimeRef.current = 0;
  }, []);

  const handleEmailTranscript = useCallback(() => {
    if (transcript.length === 0) {
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lava Math Tutor Transcript</title>
        <style>
          body { font-family: sans-serif; margin: 0; padding: 20px; background-color: #111827; color: #F9FAFB; }
          .container { max-width: 800px; margin: auto; }
          h1 { text-align: center; color: #E5E7EB; border-bottom: 1px solid #374151; padding-bottom: 10px; }
          .message-entry { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
          .message-entry.user { justify-content: flex-end; }
          .avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-weight: bold; }
          .avatar.tutor { background-color: #3B82F6; color: white; }
          .avatar.user { background-color: #16A34A; color: white; }
          .message-bubble { max-width: 70%; border-radius: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1); padding: 4px; }
          .message-bubble.user { background-color: #374151; border-bottom-right-radius: 0; }
          .message-bubble.tutor { background-color: #1F2937; border-bottom-left-radius: 0; }
          .message-bubble p { margin: 12px; }
          .message-bubble img { border-radius: 1rem; max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Lava Math Tutor Transcript</h1>
          ${transcript.map(entry => `
            <div class="message-entry ${entry.speaker === Speaker.USER ? 'user' : 'tutor'}">
              ${entry.speaker === Speaker.TUTOR ? '<div class="avatar tutor">T</div>' : ''}
              <div class="message-bubble ${entry.speaker === Speaker.USER ? 'user' : 'tutor'}">
                ${entry.image ? `<img src="${entry.image}" alt="User provided content">` : ''}
                ${entry.text ? `<p>${entry.text.replace(/\n/g, '<br>')}</p>` : ''}
              </div>
              ${entry.speaker === Speaker.USER ? '<div class="avatar user">U</div>' : ''}
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lava-math-tutor-transcript-${new Date().toISOString()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert("Transcript has been downloaded. Please attach the downloaded HTML file to your email.");

    const subject = encodeURIComponent("Lava Math Tutor Session Transcript");
    window.location.href = `mailto:zhen08@gmail.com?subject=${subject}`;
  }, [transcript]);

  const handleToggleSession = useCallback(async () => {
    if (isSessionActive) {
      if (transcript.length > 0) {
        handleEmailTranscript();
      }
      if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
      }
      return;
    }

    setStatus('CONNECTING');
    setTranscript([]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: SYSTEM_INSTRUCTION,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsSessionActive(true);
            setStatus('LISTENING');
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
            scriptProcessorRef.current = scriptProcessor;
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent) {
              const { inputTranscription, outputTranscription, modelTurn, turnComplete, interrupted } = message.serverContent;
              if (inputTranscription) userTranscriptionRef.current += inputTranscription.text;
              if (outputTranscription) modelTranscriptionRef.current += outputTranscription.text;
              
              if(interrupted) {
                stopAllPlayback();
              }

              if(modelTurn?.parts[0]?.inlineData?.data) {
                setStatus('SPEAKING');
                const audioData = decode(modelTurn.parts[0].inlineData.data);
                const audioBuffer = await decodeAudioData(audioData, outputAudioContextRef.current!, 24000, 1);
                
                const currentTime = outputAudioContextRef.current!.currentTime;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);
                
                audioPlaybackQueueRef.current.push({ buffer: audioBuffer, startTime: nextStartTimeRef.current });
                nextStartTimeRef.current += audioBuffer.duration;
                
                processAudioPlayback();
              } else if (!modelTurn) {
                 setStatus('THINKING');
              } else {
                 setStatus('LISTENING');
              }

              if (turnComplete) {
                const fullUserInput = userTranscriptionRef.current.trim();
                const fullModelOutput = modelTranscriptionRef.current.trim();
                
                const newEntries: TranscriptEntry[] = [];
                // Check if the last entry was an image-only entry from the user
                const lastEntry = transcript[transcript.length - 1];
                if (lastEntry?.speaker === Speaker.USER && lastEntry.image && !lastEntry.text && fullUserInput) {
                  // If so, update it with the transcribed text instead of creating a new entry
                  setTranscript(prev => {
                      const updated = [...prev];
                      updated[updated.length - 1].text = fullUserInput;
                      return updated;
                  });
                   if (fullModelOutput) newEntries.push({ speaker: Speaker.TUTOR, text: fullModelOutput });

                } else {
                    if (fullUserInput) newEntries.push({ speaker: Speaker.USER, text: fullUserInput });
                    if (fullModelOutput) newEntries.push({ speaker: Speaker.TUTOR, text: fullModelOutput });
                }

                if (newEntries.length > 0) {
                  setTranscript(prev => [...prev, ...newEntries]);
                }
                
                userTranscriptionRef.current = '';
                modelTranscriptionRef.current = '';
                setStatus('LISTENING');
              }
            }
          },
          onclose: () => {
            setIsSessionActive(false);
            setStatus('IDLE');
            mediaStreamRef.current?.getTracks().forEach(track => track.stop());
            scriptProcessorRef.current?.disconnect();
            inputAudioContextRef.current?.close();
            outputAudioContextRef.current?.close();
            sessionPromiseRef.current = null;
            stopAllPlayback();
          },
          onerror: (e) => {
            console.error('Session error:', e);
            alert('A network error occurred. This could be due to a missing or invalid API key, or a problem with your internet connection. Please check your setup and try again.');
            setIsSessionActive(false);
            setStatus('IDLE');
            stopAllPlayback();
          },
        },
      });
    } catch (error) {
      console.error('Failed to start session:', error);
      alert('Could not start session. Please ensure you have given microphone permissions.');
      setStatus('IDLE');
    }
  }, [isSessionActive, processAudioPlayback, stopAllPlayback, transcript, handleEmailTranscript]);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    if (!sessionPromiseRef.current) {
      alert('Please start the session before sending an image.');
      return;
    }
  
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const imageDataUrl = reader.result as string;
      setTranscript(prev => [...prev, { speaker: Speaker.USER, text: '', image: imageDataUrl }]);
  
      try {
        const base64Data = await blobToBase64(file);
        const session = await sessionPromiseRef.current!;
        session.sendRealtimeInput({
          media: { data: base64Data, mimeType: file.type }
        });
      } catch (error) {
        console.error("Failed to send image:", error);
        alert("There was an error sending the image.");
      }
    };
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      alert("Failed to read image file.");
    };
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    event.target.value = '';
  };

  const handleImageUploadClick = () => fileInputRef.current?.click();

  const handlePaste = useCallback((event: ClipboardEvent) => {
    if (!isSessionActive) return;
    const items = event.clipboardData?.items;
    if (!items) return;
  
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handleFileSelect(file);
          event.preventDefault();
          return;
        }
      }
    }
  }, [isSessionActive, handleFileSelect]);

  const handleSendDrawing = useCallback(async (imageDataUrl: string) => {
    if (!sessionPromiseRef.current) {
      alert('Please start the session before sending a drawing.');
      return;
    }

    setTranscript(prev => [...prev, { speaker: Speaker.USER, text: '', image: imageDataUrl }]);
    
    try {
        const base64Data = imageDataUrl.split(',')[1];
        if (!base64Data) {
            throw new Error("Invalid image data URL");
        }
        const session = await sessionPromiseRef.current!;
        session.sendRealtimeInput({
            media: { data: base64Data, mimeType: 'image/png' }
        });
    } catch (error) {
        console.error("Failed to send drawing:", error);
        alert("There was an error sending the drawing.");
    }
  }, []);
  
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  useEffect(() => {
    return () => {
      if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
      }
    };
  }, []);

  if (!isAuthenticated) {
    return <PinScreen onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col font-sans text-white">
      <header className="p-4 border-b border-gray-700 text-center shadow-lg">
        <h1 className="text-2xl font-bold tracking-wider">Lava Math Tutor</h1>
      </header>

      <main className="flex-grow flex flex-col min-h-0">
        <TranscriptView transcript={transcript} />
      </main>

      <footer className="p-4 border-t border-gray-700 flex flex-col items-center justify-center space-y-3">
        <StatusIndicator status={status} />
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={handleImageUploadClick}
            disabled={!isSessionActive || status === 'CONNECTING'}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-opacity-50 bg-gray-600 hover:bg-gray-700 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Upload question image"
          >
            <PaperclipIcon className="w-7 h-7 text-white" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
          />
          <button
            onClick={handleToggleSession}
            disabled={status === 'CONNECTING'}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-opacity-50
              ${isSessionActive ? 'bg-red-600 hover:bg-red-700 focus:ring-red-400' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400'}
              ${status === 'CONNECTING' ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            aria-label={isSessionActive ? "Stop session" : "Start session"}
          >
            {isSessionActive ? <StopIcon className="w-8 h-8 text-white" /> : <MicrophoneIcon className="w-8 h-8 text-white" />}
          </button>
          <button
            onClick={() => setIsDrawingPadOpen(true)}
            disabled={!isSessionActive || status === 'CONNECTING'}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-opacity-50 bg-gray-600 hover:bg-gray-700 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Open drawing pad"
          >
            <PencilIcon className="w-7 h-7 text-white" />
          </button>
        </div>
        <p className="text-xs text-gray-500 pt-1">You can also paste an image from your clipboard during an active session.</p>
      </footer>
      <DrawingPad 
        isOpen={isDrawingPadOpen}
        onClose={() => setIsDrawingPadOpen(false)}
        onSend={handleSendDrawing}
      />
    </div>
  );
};

export default App;