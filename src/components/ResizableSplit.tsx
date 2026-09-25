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
  const isDragging = useRef(false);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const { left: containerLeft, width } = containerRef.current.getBoundingClientRect();
      const rawRatio = (e.clientX - containerLeft) / width;
      // Clamp to respect minimum widths
      const minLeftRatio = minLeft / width;
      const minRightRatio = 1 - minRight / width;
      setRatio(Math.max(minLeftRatio, Math.min(minRightRatio, rawRatio)));
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
  }, [minLeft, minRight]);

  const leftPct = `${(ratio * 100).toFixed(2)}%`;
  const rightPct = `${((1 - ratio) * 100).toFixed(2)}%`;

  return (
    <div
      ref={containerRef}
      className="split-container"
      style={{
        display: 'grid',
        gridTemplateColumns: `${leftPct} 5px ${rightPct}`,
        height: '100%',
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
