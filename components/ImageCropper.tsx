import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropperProps {
  isOpen: boolean;
  src: string | null;
  onClose: () => void;
  onCrop: (croppedImageUrl: string) => void;
}

const HANDLE_SIZE = 10;
const MIN_CROP_SIZE = 20;

type Handle = 'top-left' | 'top-middle' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom-left' | 'bottom-middle' | 'bottom-right';
type Action = 'move' | Handle | null;


const ImageCropper: React.FC<ImageCropperProps> = ({ isOpen, src, onClose, onCrop }) => {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, width: 0, height: 0 });
  const [action, setAction] = useState<Action>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const dragStartCropRef = useRef<Crop | null>(null);

  const getCanvasCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const nativeEvent = e.nativeEvent;
    let clientX, clientY;
    if (nativeEvent instanceof MouseEvent) {
        clientX = nativeEvent.clientX;
        clientY = nativeEvent.clientY;
    } else if (nativeEvent instanceof TouchEvent && nativeEvent.touches.length > 0) {
        clientX = nativeEvent.touches[0].clientX;
        clientY = nativeEvent.touches[0].clientY;
    } else {
        return { x: 0, y: 0 };
    }
    
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const getHandleAtPosition = useCallback((x: number, y: number): Handle | null => {
    const { x: cx, y: cy, width: cw, height: ch } = crop;
    const hs = HANDLE_SIZE; // Handle size

    // Corner handles
    if (x >= cx - hs && x <= cx + hs && y >= cy - hs && y <= cy + hs) return 'top-left';
    if (x >= cx + cw - hs && x <= cx + cw + hs && y >= cy - hs && y <= cy + hs) return 'top-right';
    if (x >= cx - hs && x <= cx + hs && y >= cy + ch - hs && y <= cy + ch + hs) return 'bottom-left';
    if (x >= cx + cw - hs && x <= cx + cw + hs && y >= cy + ch - hs && y <= cy + ch + hs) return 'bottom-right';

    // Middle handles
    if (x >= cx + cw / 2 - hs && x <= cx + cw / 2 + hs && y >= cy - hs && y <= cy + hs) return 'top-middle';
    if (x >= cx + cw / 2 - hs && x <= cx + cw / 2 + hs && y >= cy + ch - hs && y <= cy + ch + hs) return 'bottom-middle';
    if (x >= cx - hs && x <= cx + hs && y >= cy + ch / 2 - hs && y <= cy + ch / 2 + hs) return 'middle-left';
    if (x >= cx + cw - hs && x <= cx + cw + hs && y >= cy + ch / 2 - hs && y <= cy + ch / 2 + hs) return 'middle-right';

    return null;
  }, [crop]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !image.complete) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    ctx.drawImage(image, 0, 0);

    const overlayColor = 'rgba(0, 0, 0, 0.6)';
    ctx.fillStyle = overlayColor;
    ctx.fillRect(0, 0, canvas.width, crop.y);
    ctx.fillRect(0, crop.y + crop.height, canvas.width, canvas.height - (crop.y + crop.height));
    ctx.fillRect(0, crop.y, crop.x, crop.height);
    ctx.fillRect(crop.x + crop.width, crop.y, canvas.width - (crop.x + crop.width), crop.height);
    
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);

    // Draw handles
    ctx.fillStyle = '#FFFFFF';
    const { x, y, width, height } = crop;
    const handles = [
        { x: x, y: y }, // top-left
        { x: x + width / 2, y: y }, // top-middle
        { x: x + width, y: y }, // top-right
        { x: x, y: y + height / 2 }, // middle-left
        { x: x + width, y: y + height / 2 }, // middle-right
        { x: x, y: y + height }, // bottom-left
        { x: x + width / 2, y: y + height }, // bottom-middle
        { x: x + width, y: y + height }, // bottom-right
    ];
    handles.forEach(handle => {
        ctx.fillRect(handle.x - HANDLE_SIZE / 2, handle.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    });
  }, [crop]);

  useEffect(() => {
    if (isOpen) {
        draw();
    }
  }, [crop, isOpen, draw]);
  
  useEffect(() => {
    if (!src || !isOpen) return;
    const image = new Image();
    image.src = src;
    image.onload = () => {
        imageRef.current = image;
        setCrop({
            x: 0,
            y: 0,
            width: image.naturalWidth,
            height: image.naturalHeight,
        });
    };
  }, [src, isOpen]);

  const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const { x, y } = getCanvasCoordinates(e);
    const handle = getHandleAtPosition(x, y);

    if (handle) {
        setAction(handle);
    } else {
        const isMoving = x >= crop.x && x <= crop.x + crop.width && y >= crop.y && y <= crop.y + crop.height;
        if (isMoving) {
            setAction('move');
            setDragStartPos({ x: x - crop.x, y: y - crop.y });
        }
    }
    dragStartCropRef.current = { ...crop };
  };

  const handleInteractionMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!action || !dragStartCropRef.current) return;
    e.preventDefault();
    const { x, y } = getCanvasCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    let newCrop = { ...crop };
    const startCrop = dragStartCropRef.current;

    if (action === 'move') {
      const nextX = x - dragStartPos.x;
      const nextY = y - dragStartPos.y;
      newCrop.x = Math.max(0, Math.min(nextX, canvas.width - newCrop.width));
      newCrop.y = Math.max(0, Math.min(nextY, canvas.height - newCrop.height));
    } else {
        // Resize logic
        if (action.includes('top')) {
            const newY = Math.min(y, startCrop.y + startCrop.height - MIN_CROP_SIZE);
            newCrop.height = startCrop.y + startCrop.height - newY;
            newCrop.y = newY;
        }
        if (action.includes('bottom')) {
            newCrop.height = Math.max(MIN_CROP_SIZE, y - startCrop.y);
        }
        if (action.includes('left')) {
            const newX = Math.min(x, startCrop.x + startCrop.width - MIN_CROP_SIZE);
            newCrop.width = startCrop.x + startCrop.width - newX;
            newCrop.x = newX;
        }
        if (action.includes('right')) {
            newCrop.width = Math.max(MIN_CROP_SIZE, x - startCrop.x);
        }
        
        // Clamp to canvas boundaries
        if (newCrop.x < 0) { newCrop.width += newCrop.x; newCrop.x = 0; }
        if (newCrop.y < 0) { newCrop.height += newCrop.y; newCrop.y = 0; }
        if (newCrop.x + newCrop.width > canvas.width) { newCrop.width = canvas.width - newCrop.x; }
        if (newCrop.y + newCrop.height > canvas.height) { newCrop.height = canvas.height - newCrop.y; }
    }
    
    setCrop(newCrop);
  };

  const handleInteractionEnd = () => {
    setAction(null);
    dragStartCropRef.current = null;
  };
  
  const handleFinalCrop = () => {
    const image = imageRef.current;
    if (!image || crop.width <= 0 || crop.height <= 0) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = crop.width;
    tempCanvas.height = crop.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    );
    
    onCrop(tempCanvas.toDataURL('image/png'));
    onClose();
  };
  
  const handleCanvasMouseMoveForCursor = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || action) return;
    const { x, y } = getCanvasCoordinates(e);
    
    const handle = getHandleAtPosition(x, y);
    if (handle) {
      if (handle === 'top-left' || handle === 'bottom-right') canvas.style.cursor = 'nwse-resize';
      else if (handle === 'top-right' || handle === 'bottom-left') canvas.style.cursor = 'nesw-resize';
      else if (handle.includes('top') || handle.includes('bottom')) canvas.style.cursor = 'ns-resize';
      else if (handle.includes('left') || handle.includes('right')) canvas.style.cursor = 'ew-resize';
    } else {
        const isMoving = x >= crop.x && x <= crop.x + crop.width && y >= crop.y && y <= crop.y + crop.height;
        if (isMoving) canvas.style.cursor = 'move';
        else canvas.style.cursor = 'default';
    }
  };

  if (!isOpen || !src) return null;

  return (
     <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="cropper-title">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full h-full max-w-4xl max-h-[90vh] flex flex-col">
        <header className="p-4 border-b border-gray-700">
            <h2 id="cropper-title" className="text-lg font-semibold text-center">Crop Your Question</h2>
        </header>
        
        <div className="flex-grow p-4 flex items-center justify-center bg-gray-900 overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={handleInteractionStart}
              onMouseMove={(e) => {
                  handleInteractionMove(e);
                  handleCanvasMouseMoveForCursor(e);
              }}
              onMouseUp={handleInteractionEnd}
              onMouseLeave={handleInteractionEnd}
              onTouchStart={handleInteractionStart}
              onTouchMove={handleInteractionMove}
              onTouchEnd={handleInteractionEnd}
              className="max-w-full max-h-full"
            />
        </div>

        <footer className="p-4 flex justify-end gap-4 border-t border-gray-700">
          <button onClick={onClose} className="px-6 py-2 bg-gray-600 rounded-md hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={handleFinalCrop} className="px-6 py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">Crop & Send</button>
        </footer>
      </div>
    </div>
  );
};

export default ImageCropper;
