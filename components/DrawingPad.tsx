import React, { useRef, useEffect, useState, useCallback } from 'react';

interface DrawingPadProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (imageDataUrl: string) => void;
}

const DrawingPad: React.FC<DrawingPadProps> = ({ isOpen, onClose, onSend }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#FFFFFF');
  const [lineWidth, setLineWidth] = useState(5);
  const ERASER_COLOR = '#111827'; // Corresponds to bg-gray-900

  // Resize handler now accounts for both window size changes and high-DPI displays.
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Only update if the size or resolution has changed to avoid unnecessary redraws.
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const context = canvas.getContext('2d');
      if (!context) return;
      
      // Scale the context to match the device pixel ratio, ensuring 1-to-1 mapping.
      context.scale(dpr, dpr);

      // Canvas styles are reset on resize, so we must re-apply them.
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      contextRef.current = context;
    }
  }, [color, lineWidth]);

  // This effect manages the canvas setup and attaches the resize listener.
  useEffect(() => {
    if (isOpen) {
      handleResize(); // Set initial size correctly.
      window.addEventListener('resize', handleResize);

      // Cleanup function to remove the listener when the component unmounts or closes.
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen, handleResize]);

  // These effects update the drawing context when color or line width changes.
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = color;
    }
  }, [color]);
  
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.lineWidth = lineWidth;
    }
  }, [lineWidth]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const event = e.nativeEvent;
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else if (event instanceof TouchEvent && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      return { x: 0, y: 0 };
    }
    
    // This calculation correctly finds the pointer position relative to the canvas.
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!contextRef.current) return;
    const { x, y } = getCoords(e);
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    if (!contextRef.current) return;
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !contextRef.current) return;
    const { x, y } = getCoords(e);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (canvas && context) {
      // The coordinates for clearRect are scaled, so this clears the entire visible area.
      const rect = canvas.getBoundingClientRect();
      context.clearRect(0, 0, rect.width, rect.height);
    }
  };

  const handleSend = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onSend(dataUrl);
      onClose(); // Close pad after sending
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="drawing-pad-title">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full h-full max-w-4xl max-h-[90vh] flex flex-col">
        <header className="p-4 border-b border-gray-700">
            <h2 id="drawing-pad-title" className="text-lg font-semibold text-center">Drawing Pad</h2>
        </header>

        <div className="p-4 flex flex-wrap items-center justify-center gap-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
                <span className="text-sm">Color:</span>
                {['#FFFFFF', '#FF3B30', '#34C759', '#007AFF', '#FF9500'].map(c => (
                    <button key={c} onClick={() => setColor(c)} style={{ backgroundColor: c }} className={`w-8 h-8 rounded-full border-2 transition-transform transform hover:scale-110 ${color === c ? 'border-yellow-400 scale-110' : 'border-gray-600'}`} aria-label={`Color ${c}`}></button>
                ))}
            </div>
            <div className="flex items-center gap-3">
                <span className="text-sm">Size:</span>
                {[2, 5, 10, 20].map(size => (
                    <button key={size} onClick={() => setLineWidth(size)} className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-transform transform hover:scale-110 ${lineWidth === size ? 'border-yellow-400 scale-110' : 'border-gray-600'}`} aria-label={`Brush size ${size}`}>
                        <span style={{width: `${size+2}px`, height: `${size+2}px`}} className="bg-white rounded-full block"></span>
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-2">
                 <button onClick={() => setColor(ERASER_COLOR)} className={`px-4 py-2 bg-gray-600 rounded-md text-sm hover:bg-gray-700 transition-colors ${color === ERASER_COLOR ? 'ring-2 ring-yellow-400' : ''}`}>Eraser</button>
                 <button onClick={handleClear} className="px-4 py-2 bg-yellow-600 rounded-md text-sm hover:bg-yellow-700 transition-colors">Clear</button>
            </div>
        </div>
        
        <div className="flex-grow p-4 relative">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseUp={finishDrawing}
              onMouseLeave={finishDrawing}
              onMouseMove={draw}
              onTouchStart={startDrawing}
              onTouchEnd={finishDrawing}
              onTouchMove={draw}
              className="absolute top-0 left-0 w-full h-full bg-gray-900 rounded-md cursor-crosshair"
            />
        </div>

        <footer className="p-4 flex justify-end gap-4 border-t border-gray-700">
          <button onClick={onClose} className="px-6 py-2 bg-gray-600 rounded-md hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={handleSend} className="px-6 py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">Send</button>
        </footer>
      </div>
    </div>
  );
};

export default DrawingPad;
