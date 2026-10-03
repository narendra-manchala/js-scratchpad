import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialRatio?: number; // 0–1, default 0.55
  ratio?: number;
  onRatioChange?: (ratio: number) => void;
  minLeft?: number;      // px
  minRight?: number;     // px
  isMobile?: boolean;
  isMobileExpanded?: boolean;
}

export function ResizableSplit({
  left,
  right,
  initialRatio = 0.55,
  ratio: controlledRatio,
  onRatioChange,
  minLeft = 280,
  minRight = 240,
  isMobile = false,
  isMobileExpanded = false,
}: ResizableSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalRatio, setInternalRatio] = useState(initialRatio);
  const ratio = controlledRatio !== undefined ? controlledRatio : internalRatio;
  const setRatio = useCallback((r: number) => {
    setInternalRatio(r);
    onRatioChange?.(r);
  }, [onRatioChange]);

  const isDragging = useRef(false);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = isMobile ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  }, [isMobile]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let rawRatio = 0;
      let minRatio = 0;
      let maxRatio = 1;

      if (isMobile) {
        // Vertical dragging
        rawRatio = (e.clientY - rect.top) / rect.height;
        minRatio = 100 / rect.height; // At least 100px top
        maxRatio = 1 - (100 / rect.height); // At least 100px bottom
      } else {
        // Horizontal dragging
        rawRatio = (e.clientX - rect.left) / rect.width;
        minRatio = minLeft / rect.width;
        maxRatio = 1 - (minRight / rect.width);
      }
      
      setRatio(Math.max(minRatio, Math.min(maxRatio, rawRatio)));
    };

    const stopDrag = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', stopDrag);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', stopDrag);
    };
  }, [minLeft, minRight, isMobile]);

  const leftPct = `${(ratio * 100).toFixed(2)}%`;
  const rightPct = `${((1 - ratio) * 100).toFixed(2)}%`;

  return (
    <div
      ref={containerRef}
      className={`split-container ${isMobile ? 'split-mobile' : 'split-horizontal'}`}
      style={isMobile ? {
        display: 'block',
        position: 'relative',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      } : {
        display: 'grid',
        gridTemplateColumns: `${leftPct} 5px ${rightPct}`,
        gridTemplateRows: '100%',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <div className="split-pane split-left" style={isMobile ? { height: '100%', width: '100%' } : {}}>{left}</div>
      {!isMobile && (
        <div
          className="split-divider"
          onMouseDown={startDrag}
          role="separator"
          aria-label="Resize panels"
          title="Drag to resize"
        >
          <div className="divider-handle" />
        </div>
      )}
      <div 
        className="split-pane split-right" 
        style={isMobile ? {
           position: 'absolute',
           bottom: 0,
           left: 0,
           right: 0,
           height: isMobileExpanded ? '75%' : '40px',
           transition: 'height 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
           zIndex: 10,
           boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
           background: 'var(--bg-raised)',
        } : {}}
      >
        {right}
      </div>
    </div>
  );
}
