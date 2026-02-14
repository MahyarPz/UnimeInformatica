'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

/**
 * ParticleTrail — Canvas overlay that spawns glowing particles at the cursor.
 * Mount once in the root layout. Purely decorative.
 */
export function ParticleTrail({
  particleCount = 3,
  colors = [210, 250, 280], // hue values (blue, cyan, purple)
}: {
  particleCount?: number;
  colors?: number[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const mouse = useRef({ x: -100, y: -100 });
  const animId = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const handleMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;

      // Spawn new particles on move
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 1.5 + 0.5;
        particles.current.push({
          x: mouse.current.x,
          y: mouse.current.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.5, // slight upward drift
          life: 0,
          maxLife: 40 + Math.random() * 30,
          size: Math.random() * 3 + 1.5,
          hue: colors[Math.floor(Math.random() * colors.length)],
        });
      }

      // Cap particle count
      if (particles.current.length > 200) {
        particles.current = particles.current.slice(-200);
      }
    };

    window.addEventListener('mousemove', handleMove);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.current = particles.current.filter((p) => {
        p.life++;
        if (p.life > p.maxLife) return false;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02; // gravity

        const progress = p.life / p.maxLife;
        const alpha = 1 - progress;
        const scale = 1 - progress * 0.5;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * scale, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, ${alpha * 0.7})`;
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * scale * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, ${alpha * 0.15})`;
        ctx.fill();

        return true;
      });

      animId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMove);
    };
  }, [particleCount, colors]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[9999]"
      style={{ mixBlendMode: 'screen' }}
      aria-hidden
    />
  );
}
