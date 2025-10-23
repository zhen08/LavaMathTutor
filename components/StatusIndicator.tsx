
import React from 'react';
import { BrainIcon, MicrophoneIcon, SoundWaveIcon } from './Icons';

type Status = 'IDLE' | 'CONNECTING' | 'LISTENING' | 'THINKING' | 'SPEAKING';

interface StatusIndicatorProps {
  status: Status;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  const getStatusContent = () => {
    switch (status) {
      case 'CONNECTING':
        return (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
            <span className="ml-3">Connecting...</span>
          </>
        );
      case 'LISTENING':
        return (
          <>
            <MicrophoneIcon className="h-5 w-5 text-red-500 animate-pulse" />
            <span className="ml-3">Listening...</span>
          </>
        );
      case 'THINKING':
        return (
          <>
            <BrainIcon className="h-5 w-5 text-blue-400 animate-pulse" />
            <span className="ml-3">Thinking...</span>
          </>
        );
      case 'SPEAKING':
        return (
          <>
            <SoundWaveIcon className="h-5 w-5 text-green-400" />
            <span className="ml-3">Tutor is speaking...</span>
          </>
        );
      case 'IDLE':
      default:
        return <span>Ready to start</span>;
    }
  };

  return (
    <div className="flex items-center justify-center h-8 text-sm text-gray-400 font-mono">
      {getStatusContent()}
    </div>
  );
};

export default StatusIndicator;
