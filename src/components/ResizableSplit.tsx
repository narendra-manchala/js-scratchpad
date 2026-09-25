import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialRatio?: number; // 0–1, default 0.55
  minLeft?: number;      // px
  minRight?: number;     // px
}

export function ResizableSplit({
  left,
  right,
  initialRatio = 0.55,
  minLeft = 280,
  minRight = 240,
}: ResizableSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(initialRatio);
  const [isMobile, setIsMobile] = useState(false);
  const isDragging = useRef(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const update = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    update(mql);
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

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
      className={`split-container ${isMobile ? 'split-vertical' : 'split-horizontal'}`}
      style={{
        display: 'grid',
        ...(isMobile 
          ? { gridTemplateRows: `${leftPct} 5px ${rightPct}`, gridTemplateColumns: '1fr' }
          : { gridTemplateColumns: `${leftPct} 5px ${rightPct}`, gridTemplateRows: '100%' }
        ),
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <div className="split-pane split-left">{left}</div>
      <div
        className="split-divider"
        onMouseDown={startDrag}
        role="separator"
        aria-label="Resize panels"
        title="Drag to resize"
      >
        <div className="divider-handle" />
      </div>
      <div className="split-pane split-right">{right}</div>
    </div>
  );
}
