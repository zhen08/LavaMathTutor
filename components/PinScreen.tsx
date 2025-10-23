import React, { useState, FormEvent } from 'react';
import { LockIcon } from './Icons';

interface PinScreenProps {
  onSuccess: () => void;
}

const PinScreen: React.FC<PinScreenProps> = ({ onSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (pin === 'bruh') {
      onSuccess();
    } else {
      setError('Incorrect PIN. Please try again.');
      setPin('');
    }
  };

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col items-center justify-center font-sans text-white p-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 bg-gray-800 rounded-full h-20 w-20 flex items-center justify-center">
          <LockIcon className="h-10 w-10 text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">PIN Required</h1>
        <p className="text-gray-400 mb-8">Enter the PIN to access the tutor.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError('');
            }}
            className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-700 rounded-lg text-white text-center text-2xl tracking-widest focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="••••"
            maxLength={4}
            autoFocus
          />
          {error && <p className="text-red-500 mt-4">{error}</p>}
          <button
            type="submit"
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
};

export default PinScreen;
