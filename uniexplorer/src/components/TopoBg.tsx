import React, { useEffect, useRef } from 'react';
import './TopoBg.css';

export const TopoBg = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const lines = 15;
    const points = 10;
    const waveSpeed = 0.0003;
    let time = 0;

    const draw = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      time += waveSpeed;

      for (let i = 0; i < lines; i++) {
        ctx.beginPath();
        const baseHeight = (height / lines) * i;
        
        ctx.moveTo(0, baseHeight);
        for (let j = 0; j <= points; j++) {
          const x = (width / points) * j;
          const offset = Math.sin(j * 0.6 + time * 4 + i) * 20 + Math.cos(j * 0.4 - time * 2.5 + i * 1.5) * 25;
          ctx.lineTo(x, baseHeight + offset);
        }
        
        // Very subtle green/sand biophilic contour lines
        ctx.strokeStyle = `rgba(21, 128, 61, ${0.015 + (i % 3 === 0 ? 0.015 : 0)})`;
        ctx.lineWidth = i % 3 === 0 ? 1.5 : 0.8;
        ctx.stroke();
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return <canvas ref={canvasRef} className="topo-bg-canvas animate-fade-in" />;
};
