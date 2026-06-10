"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
};

type LightBand = {
  y: number;
  speed: number;
  width: number;
  height: number;
};

export function LoginParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = window.innerWidth < 768;
    const PARTICLE_COUNT = isMobile ? 30 : 60;
    const ENABLE_BANDS = !isMobile;
    const GRID_SIZE = 60;

    let w = 0;
    let h = 0;
    let mouseX = -9999;
    let mouseY = -9999;
    let mouseInside = false;
    let animId = 0;

    const particles: Particle[] = [];
    const bands: LightBand[] = [
      { y: 0.3, speed: 0.15, width: 0.6, height: 80 },
      { y: 0.65, speed: 0.1, width: 0.5, height: 60 },
    ];

    function resize() {
      if (!canvas) return;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * (window.devicePixelRatio || 1);
      canvas.height = h * (window.devicePixelRatio || 1);
      ctx!.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    }

    function initParticles() {
      particles.length = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * (w || window.innerWidth),
          y: Math.random() * (h || window.innerHeight),
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 1.5 + 0.5,
          alpha: Math.random() * 0.4 + 0.1,
        });
      }
    }

    function drawGrid() {
      if (!ctx) return;
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x = 0; x < w; x += GRID_SIZE) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y < h; y += GRID_SIZE) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    }

    function drawBands(t: number) {
      if (!ctx || !ENABLE_BANDS) return;
      for (const band of bands) {
        const bandY = h * band.y + Math.sin(t * band.speed * 0.001) * 40;
        const offset = (t * band.speed * 0.05) % (w * 2);
        const bandX = offset - w * band.width;
        const grad = ctx.createLinearGradient(bandX, 0, bandX + w * band.width, 0);
        grad.addColorStop(0, "rgba(22,93,255,0)");
        grad.addColorStop(0.3, "rgba(123,97,255,0.04)");
        grad.addColorStop(0.5, "rgba(123,97,255,0.06)");
        grad.addColorStop(0.7, "rgba(123,97,255,0.04)");
        grad.addColorStop(1, "rgba(22,93,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, bandY - band.height / 2, w, band.height);
      }
    }

    function drawParticles() {
      if (!ctx) return;
      for (const p of particles) {
        if (mouseInside) {
          const dx = mouseX - p.x;
          const dy = mouseY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200 && dist > 1) {
            const force = 0.02 * (1 - dist / 200);
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        p.vx *= 0.995;
        p.vy *= 0.995;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(140,160,255,${p.alpha})`;
        ctx.fill();
      }

      ctx.strokeStyle = "rgba(140,160,255,0.06)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = dx * dx + dy * dy;
          if (dist < 12000) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    }

    let startTime = 0;
    function animate(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const t = timestamp - startTime;
      ctx!.clearRect(0, 0, w, h);
      drawGrid();
      drawBands(t);
      drawParticles();
      animId = requestAnimationFrame(animate);
    }

    resize();
    initParticles();
    animId = requestAnimationFrame(animate);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const parent = canvas.parentElement;
    const onMouseMove = (e: MouseEvent) => {
      mouseInside = true;
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    const onMouseLeave = () => { mouseInside = false; };
    if (parent) {
      parent.addEventListener("mousemove", onMouseMove);
      parent.addEventListener("mouseleave", onMouseLeave);
    }

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      if (parent) {
        parent.removeEventListener("mousemove", onMouseMove);
        parent.removeEventListener("mouseleave", onMouseLeave);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ background: "#080C16" }}
    />
  );
}
