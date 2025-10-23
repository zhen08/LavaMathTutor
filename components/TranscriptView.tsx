
import React, { useRef, useEffect } from 'react';
import { Speaker, TranscriptEntry } from '../types';

interface TranscriptViewProps {
  transcript: TranscriptEntry[];
}

const TranscriptView: React.FC<TranscriptViewProps> = ({ transcript }) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  return (
    <div className="flex-grow p-6 overflow-y-auto space-y-6">
      {transcript.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center">
            <h2 className="text-2xl font-bold mb-2">Welcome to your Lava Math Tutor!</h2>
            <p>I'm here to help you solve math problems by asking guiding questions.</p>
            <p>Click the microphone button below to start our session.</p>
        </div>
      ) : (
        transcript.map((entry, index) => (
          <div key={index} className={`flex items-start gap-4 ${entry.speaker === Speaker.USER ? 'justify-end' : 'justify-start'}`}>
            {entry.speaker === Speaker.TUTOR && (
              <div className="w-10 h-10 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center font-bold text-white">T</div>
            )}
            <div className={`max-w-xl rounded-2xl shadow-md ${entry.speaker === Speaker.USER ? 'bg-gray-700 rounded-br-none' : 'bg-gray-800 rounded-bl-none'} ${entry.image && !entry.text ? 'p-2' : 'p-4'}`}>
              {entry.image && (
                <img src={entry.image} alt="User-provided math problem" className="rounded-md max-w-full h-auto" />
              )}
              {entry.text && (
                <p className="text-white">{entry.text}</p>
              )}
            </div>
             {entry.speaker === Speaker.USER && (
              <div className="w-10 h-10 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center font-bold text-white">U</div>
            )}
          </div>
        ))
      )}
      <div ref={endOfMessagesRef} />
    </div>
  );
};

export default TranscriptView;