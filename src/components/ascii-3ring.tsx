import { useEffect, useRef, useState } from 'react';

interface Point3D {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

interface Ascii3Props {
  compact?: boolean;
}

export default function Ascii3({ compact = false }: Ascii3Props) {
  const preRef = useRef<HTMLPreElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const width = compact ? 48 : 200;
    const height = compact ? 48 : 80;
    const zBuffer = new Float32Array(width * height);
    const bBuffer = new Array<string>(width * height).fill(' ');
    const chars = ' .:-=+*#%@███';

    const R_out = 2.3;
    const R_in = 2.0;
    const H = 1.2;
    const offset = 2.5;
    const K2 = 8;
    const K1 = compact ? 20 : 55;

    const points: Point3D[] = [];
    const tStep = 0.02;
    const zStep = 0.05;
    const rStep = 0.05;

    for (let t = 0; t < Math.PI * 2; t += tStep) {
      const ct = Math.cos(t);
      const st = Math.sin(t);

      for (let z = -H / 2; z <= H / 2; z += zStep) {
        points.push({
          x: R_out * ct - offset,
          y: R_out * st,
          z,
          nx: ct,
          ny: st,
          nz: 0,
        });
        points.push({
          x: R_in * ct - offset,
          y: R_in * st,
          z,
          nx: -ct,
          ny: -st,
          nz: 0,
        });
      }

      for (let r = R_in; r <= R_out; r += rStep) {
        points.push({
          x: r * ct - offset,
          y: r * st,
          z: H / 2,
          nx: 0,
          ny: 0,
          nz: 1,
        });
        points.push({
          x: r * ct - offset,
          y: r * st,
          z: -H / 2,
          nx: 0,
          ny: 0,
          nz: -1,
        });
      }
    }

    for (let t = 0; t < Math.PI * 2; t += tStep) {
      const ct = Math.cos(t);
      const st = Math.sin(t);

      for (let y = -H / 2; y <= H / 2; y += zStep) {
        points.push({
          x: R_out * ct,
          y,
          z: R_out * st,
          nx: ct,
          ny: 0,
          nz: st,
        });
        points.push({
          x: R_in * ct,
          y,
          z: R_in * st,
          nx: -ct,
          ny: 0,
          nz: -st,
        });
      }

      for (let r = R_in; r <= R_out; r += rStep) {
        points.push({ x: r * ct, y: H / 2, z: r * st, nx: 0, ny: 1, nz: 0 });
        points.push({ x: r * ct, y: -H / 2, z: r * st, nx: 0, ny: -1, nz: 0 });
      }
    }

    for (let t = 0; t < Math.PI * 2; t += tStep) {
      const ct = Math.cos(t);
      const st = Math.sin(t);

      for (let z = -H / 2; z <= H / 2; z += zStep) {
        points.push({
          x: R_out * ct + offset,
          y: R_out * st,
          z,
          nx: ct,
          ny: st,
          nz: 0,
        });
        points.push({
          x: R_in * ct + offset,
          y: R_in * st,
          z,
          nx: -ct,
          ny: -st,
          nz: 0,
        });
      }

      for (let r = R_in; r <= R_out; r += rStep) {
        points.push({
          x: r * ct + offset,
          y: r * st,
          z: H / 2,
          nx: 0,
          ny: 0,
          nz: 1,
        });
        points.push({
          x: r * ct + offset,
          y: r * st,
          z: -H / 2,
          nx: 0,
          ny: 0,
          nz: -1,
        });
      }
    }

    let animationFrameId = 0;
    let rotA = 0;
    let rotB = 0;
    let targetVelA = 0.015;
    let targetVelB = 0.01;
    let currentVelA = 0.015;
    let currentVelB = 0.01;

    const lx = -0.5;
    const ly = 0.5;
    const lz = -0.707;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || compact) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;

      targetVelB = x * 0.06;
      targetVelA = y * 0.06;
    };

    const handleMouseLeave = () => {
      targetVelA = 0.015;
      targetVelB = 0.01;
    };

    const currentContainer = containerRef.current;
    if (currentContainer && !compact) {
      currentContainer.addEventListener('mousemove', handleMouseMove);
      currentContainer.addEventListener('mouseleave', handleMouseLeave);
    }

    const render = () => {
      currentVelA += (targetVelA - currentVelA) * 0.05;
      currentVelB += (targetVelB - currentVelB) * 0.05;

      rotA += currentVelA;
      rotB += currentVelB;

      const cosA = Math.cos(rotA);
      const sinA = Math.sin(rotA);
      const cosB = Math.cos(rotB);
      const sinB = Math.sin(rotB);

      for (let i = 0; i < width * height; i++) {
        bBuffer[i] = ' ';
        zBuffer[i] = -Infinity;
      }

      for (let i = 0; i < points.length; i++) {
        const pt = points[i];

        const y1 = pt.y * cosA - pt.z * sinA;
        const z1 = pt.y * sinA + pt.z * cosA;
        const ny1 = pt.ny * cosA - pt.nz * sinA;
        const nz1 = pt.ny * sinA + pt.nz * cosA;

        const x2 = pt.x * cosB - y1 * sinB;
        const y2 = pt.x * sinB + y1 * cosB;
        const z2 = z1;
        const nx2 = pt.nx * cosB - ny1 * sinB;
        const ny2 = pt.nx * sinB + ny1 * cosB;
        const nz2 = nz1;

        const ooz = 1 / (K2 + z2);
        const xp = Math.floor(width / 2 + K1 * ooz * x2);
        const yp = Math.floor(height / 2 - K1 * ooz * y2 * 0.5);
        const L = nx2 * lx + ny2 * ly + nz2 * lz;

        if (xp >= 0 && xp < width && yp >= 0 && yp < height) {
          const idx = xp + yp * width;
          if (ooz > zBuffer[idx]) {
            zBuffer[idx] = ooz;
            if (L > 0) {
              let luminanceIndex = Math.floor(L * chars.length);
              if (luminanceIndex < 0) luminanceIndex = 0;
              if (luminanceIndex >= chars.length) luminanceIndex = chars.length - 1;
              bBuffer[idx] = chars[luminanceIndex];
            } else {
              bBuffer[idx] = ' ';
            }
          }
        }
      }

      let output = '';
      for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; i++) {
          output += bBuffer[i + j * width];
        }
        output += '\n';
      }

      if (preRef.current) {
        preRef.current.textContent = output;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (currentContainer && !compact) {
        currentContainer.removeEventListener('mousemove', handleMouseMove);
        currentContainer.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [compact]);

  return (
    <div
      ref={containerRef}
      className={compact
        ? 'relative w-full h-full bg-[#000000] flex items-center justify-center overflow-hidden font-mono'
        : 'relative min-h-screen bg-[#000000] flex flex-col items-center justify-center overflow-hidden cursor-crosshair font-mono'}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="z-10 relative flex items-center justify-center">
        <pre
          ref={preRef}
          className={compact
            ? 'text-[0.12rem] leading-none tracking-tight font-bold select-none'
            : 'text-[0.25rem] sm:text-[0.35rem] md:text-[0.45rem] lg:text-[0.5rem] leading-none tracking-tight font-bold'}
          style={{
            color: '#ff7700',
            textShadow: compact
              ? '0px 0px 2px rgba(255, 119, 0, 0.45)'
              : '0px 0px 4px rgba(255, 119, 0, 0.5)',
          }}
        />
      </div>

      {!compact && (
        <div
          className={`absolute bottom-8 left-0 right-0 text-center transition-opacity duration-700 ${isHovering ? 'opacity-100' : 'opacity-0'}`}
        >
          <p className="text-[#ff7700] text-xs tracking-[0.2em] font-light uppercase opacity-50">
            Interact via Mouse Movement
          </p>
        </div>
      )}
    </div>
  );
}
