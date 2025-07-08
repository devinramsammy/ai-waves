import { useEffect, useRef, useCallback, useState } from 'react';
import { PromptInterface } from './PromptInterface';

interface AIGeneratedVisualizerProps {
  frequencyData: Uint8Array | null;
  isActive: boolean;
  onExit: () => void;
}

interface GeneratedVisualization {
  prompt: string;
  code: string;
  drawFunction?: (ctx: CanvasRenderingContext2D, frequencyData: Uint8Array, canvas: HTMLCanvasElement, timeRef: React.MutableRefObject<number>) => void;
  error?: string;
}

export const AIGeneratedVisualizer: React.FC<AIGeneratedVisualizerProps> = ({
  frequencyData,
  isActive,
  onExit,
}) => {
  const aiCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const bpmCanvasRef = useRef<HTMLCanvasElement>(null);
  const oscilloscopeCanvasRef = useRef<HTMLCanvasElement>(null);
  const matrixCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const currentIndexRef = useRef<number>(-1);
  const savedVisualizationsRef = useRef<GeneratedVisualization[]>([]);
  
  const [showPromptInterface, setShowPromptInterface] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedVisualizations, setSavedVisualizations] = useState<GeneratedVisualization[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [audioStats, setAudioStats] = useState({
    volume: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    peak: 0,
    rms: 0
  });
  const [bpmHistory, setBpmHistory] = useState<number[]>([]);
  const [currentBPM, setCurrentBPM] = useState(0);
  const lastBeatTime = useRef(0);
  const beatHistory = useRef<number[]>([]);
  const smoothedBPM = useRef(0);
  const bpmSmoothingBuffer = useRef<number[]>([]);
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [emotionColors, setEmotionColors] = useState({
    hue: 200,
    saturation: 70,
    lightness: 50
  });
  const emotionHistory = useRef<string[]>([]);
  const lastEmotionTime = useRef(0);
  const [heatmapData, setHeatmapData] = useState<number[][]>([]);
  const heatmapBuffer = useRef<number[][]>([]);

  const currentVisualization = currentIndex >= 0 ? savedVisualizations[currentIndex] : null;

  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
  };

  const analyzeEmotion = useCallback((frequencyData: Uint8Array) => {
    const currentTime = Date.now();
    
    const totalBins = frequencyData.length;
    
    const lowEnd = Math.floor(totalBins * 0.15);    // 0-15% of available spectrum (bass)
    const midStart = Math.floor(totalBins * 0.15);  // 15-75% of available spectrum (mids)
    const midEnd = Math.floor(totalBins * 0.75);
    const highStart = Math.floor(totalBins * 0.75); // 75-100% of available spectrum (treble)
    
    const lowEnergy = frequencyData.slice(0, lowEnd).reduce((sum, val) => sum + val, 0) / lowEnd;
    const midEnergy = frequencyData.slice(midStart, midEnd).reduce((sum, val) => sum + val, 0) / (midEnd - midStart);
    const highEnergy = frequencyData.slice(highStart).reduce((sum, val) => sum + val, 0) / (totalBins - highStart);
    const totalEnergy = frequencyData.reduce((sum, val) => sum + val, 0) / totalBins;
    
    const mean = totalEnergy;
    const variance = frequencyData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / totalBins;
    const isErratic = variance > 2000;
    
    const normalizedLow = lowEnergy / 255;
    const normalizedMid = midEnergy / 255;
    const normalizedHigh = highEnergy / 255;
    const normalizedTotal = totalEnergy / 255;
    
    let detectedEmotion = 'neutral';
    
    if (isErratic && normalizedHigh > 0.6) {
      detectedEmotion = 'tense';
    } else if (normalizedLow > 0.6 && normalizedTotal > 0.5) {
      detectedEmotion = 'excited';
    } else if (normalizedTotal > 0.7 && normalizedHigh > 0.6) {
      detectedEmotion = 'excited';
    } else if (normalizedLow > 0.5 && normalizedTotal > 0.3) {
      detectedEmotion = 'excited';
    } else if (normalizedTotal < 0.3 && normalizedLow > normalizedHigh && normalizedLow < 0.4) {
      detectedEmotion = 'calm';
    } else if (normalizedMid > 0.5 && normalizedTotal > 0.4 && normalizedTotal < 0.7 && normalizedLow < 0.5) {
      detectedEmotion = 'romantic';
    } else if (normalizedTotal < 0.2) {
      detectedEmotion = 'sad';
    }
    
    emotionHistory.current.push(detectedEmotion);
    if (emotionHistory.current.length > 10) {
      emotionHistory.current.shift();
    }
    
    if (emotionHistory.current.length >= 5 && currentTime - lastEmotionTime.current > 1000) {
      const emotionCounts = emotionHistory.current.reduce((counts, emotion) => {
        counts[emotion] = (counts[emotion] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
      
      const dominantEmotion = Object.entries(emotionCounts).reduce((a, b) => 
        emotionCounts[a[0]] > emotionCounts[b[0]] ? a : b
      )[0];
      
      if (dominantEmotion !== currentEmotion) {
        setCurrentEmotion(dominantEmotion);
        lastEmotionTime.current = currentTime;
      }
    }
    
    return detectedEmotion;
  }, [currentEmotion]);

  const getEmotionColor = useCallback((emotion: string, intensity: number = 1) => {
    const colorPalettes = {
      excited: { hue: 30, saturation: 100, lightness: 70 },     // Bright orange
      calm: { hue: 200, saturation: 80, lightness: 60 },        // Bright blue
      sad: { hue: 260, saturation: 70, lightness: 50 },         // Visible purple
      romantic: { hue: 320, saturation: 90, lightness: 70 },    // Bright pink
      tense: { hue: 0, saturation: 100, lightness: 60 },        // Bright red
      neutral: { hue: 180, saturation: 80, lightness: 60 }      // Bright cyan
    };
    
    const targetColors = colorPalettes[emotion as keyof typeof colorPalettes] || colorPalettes.neutral;
    
    const smoothingFactor = 0.05;
    const newColors = {
      hue: lerp(emotionColors.hue, targetColors.hue, smoothingFactor),
      saturation: lerp(emotionColors.saturation, targetColors.saturation * intensity, smoothingFactor),
      lightness: lerp(emotionColors.lightness, targetColors.lightness * intensity, smoothingFactor)
    };
    
    setEmotionColors(newColors);
    return newColors;
  }, [emotionColors, lerp]);

  const getSpectrumBarColor = useCallback((emotion: string, barIndex: number, totalBars: number, intensity: number) => {
    const colors = getEmotionColor(emotion, intensity);
    
    const hueVariation = (barIndex / totalBars) * 60 - 30; // ±30 degree variation
    const finalHue = (colors.hue + hueVariation + 360) % 360;
    
    if (emotion === 'tense' && Math.sin(Date.now() * 0.01) > 0.5) {
      return `hsla(${finalHue}, ${colors.saturation}%, ${Math.min(colors.lightness * 1.3, 90)}%, 0.9)`;
    }
    
         return `hsla(${finalHue}, ${colors.saturation}%, ${colors.lightness}%, 0.8)`;
   }, [getEmotionColor]);

   const getHeatmapColor = useCallback((magnitude: number) => {
     const normalized = magnitude / 255;
     
     if (normalized < 0.1) return 'bg-gray-900';
     if (normalized < 0.2) return 'bg-blue-900';
     if (normalized < 0.3) return 'bg-blue-700';
     if (normalized < 0.4) return 'bg-blue-500';
     if (normalized < 0.5) return 'bg-cyan-500';
     if (normalized < 0.6) return 'bg-green-500';
     if (normalized < 0.7) return 'bg-yellow-500';
     if (normalized < 0.8) return 'bg-orange-500';
     if (normalized < 0.9) return 'bg-red-500';
     return 'bg-red-300';
   }, []);

   const frameCounter = useRef(0);
   const updateHeatmapBuffer = useCallback((frequencyData: Uint8Array) => {
     frameCounter.current++;
     if (frameCounter.current % 3 !== 0) return;
     
     const numBins = 16; // Reduced from 32 to 16 for better performance
     const binSize = Math.floor(frequencyData.length / numBins);
     const newFrame: number[] = [];
     
     for (let i = 0; i < numBins; i++) {
       const startIndex = i * binSize;
       const endIndex = Math.min(startIndex + binSize, frequencyData.length);
       const binData = frequencyData.slice(startIndex, endIndex);
       const average = binData.reduce((sum, val) => sum + val, 0) / binData.length;
       newFrame.push(average);
     }
     
     heatmapBuffer.current.push(newFrame);
     
     if (heatmapBuffer.current.length > 40) {
       heatmapBuffer.current.shift();
     }
     
     setHeatmapData([...heatmapBuffer.current]);
   }, []);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    savedVisualizationsRef.current = savedVisualizations;
  }, [savedVisualizations]);

  const calculateAudioStats = useCallback((data: Uint8Array) => {
    if (!data || data.length === 0) return;

    const total = data.reduce((sum, val) => sum + val, 0);
    const average = total / data.length;
    const peak = Math.max(...Array.from(data));
    
    const third = Math.floor(data.length / 3);
    const bass = data.slice(0, third).reduce((sum, val) => sum + val, 0) / third;
    const mid = data.slice(third, third * 2).reduce((sum, val) => sum + val, 0) / third;
    const treble = data.slice(third * 2).reduce((sum, val) => sum + val, 0) / (data.length - third * 2);
    
    const rms = Math.sqrt(data.reduce((sum, val) => sum + val * val, 0) / data.length);

    const newStats = {
      volume: average / 255,
      bass: bass / 255,
      mid: mid / 255,
      treble: treble / 255,
      peak: peak / 255,
      rms: rms / 255
    };


    setAudioStats(newStats);
    
    analyzeEmotion(data);
    
    updateHeatmapBuffer(data);
  }, [analyzeEmotion, updateHeatmapBuffer]);

  const initCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      
      const width = Math.max(rect.width, 1);
      const height = Math.max(rect.height, 1);
      
      canvas.width = width;
      canvas.height = height;
      
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      
    };

    setTimeout(resizeCanvas, 100);
    
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(resizeCanvas, 10);
    });
    resizeObserver.observe(canvas);

    return () => resizeObserver.disconnect();
  }, []);

  const drawSpectrum = useCallback((ctx: CanvasRenderingContext2D, data: Uint8Array) => {
    const canvas = ctx.canvas;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    if (width === 0 || height === 0) return;
    
    ctx.clearRect(0, 0, width, height);
    const bgColor = getEmotionColor(currentEmotion, 0.1);
    ctx.fillStyle = `hsla(${bgColor.hue}, ${bgColor.saturation}%, ${Math.max(bgColor.lightness - 40, 5)}%, 0.9)`;
    ctx.fillRect(0, 0, width, height);
    
    const numBars = 64;
    const barWidth = width / numBars;
    
    for (let i = 0; i < numBars; i++) {
      const dataIndex = Math.floor((i / numBars) * data.length);
      let barHeight = (data[dataIndex] / 255) * height * 0.8;
      
      barHeight = Math.max(barHeight, height * 0.05 + Math.sin(timeRef.current * 0.001 + i) * height * 0.02);
      
      const intensity = Math.min(data[dataIndex] / 255 * 1.5, 1); // Scale intensity
      const barColor = getSpectrumBarColor(currentEmotion, i, numBars, intensity);
      
      ctx.fillStyle = barColor;
      ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
      
      ctx.shadowColor = barColor;
      ctx.shadowBlur = currentEmotion === 'tense' ? 12 : 8;
      ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
      ctx.shadowBlur = 0;
    }
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
  }, [currentEmotion, getEmotionColor, getSpectrumBarColor]);

  const drawBPM = useCallback((ctx: CanvasRenderingContext2D, data: Uint8Array) => {
    const canvas = ctx.canvas;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    if (width === 0 || height === 0) return;
    
    const bassRange = Math.floor(data.length * 0.1); // First 10% of spectrum (bass)
    const bassData = data.slice(0, bassRange);
    const bassEnergy = bassData.reduce((sum, val) => sum + val, 0) / bassRange;
    
    const totalEnergy = data.reduce((sum, val) => sum + val, 0) / data.length;
    
    const dynamicThreshold = Math.max(totalEnergy * 1.5, 50); // At least 50, or 1.5x average
    const currentTime = timeRef.current;
    
    if (bassEnergy > dynamicThreshold && currentTime - lastBeatTime.current > 300) { // Increased to 300ms for stability
      beatHistory.current.push(currentTime);
      lastBeatTime.current = currentTime;
      
      if (beatHistory.current.length > 6) {
        beatHistory.current.shift();
      }
      
      if (beatHistory.current.length >= 3) {
        const intervals = [];
        for (let i = 1; i < beatHistory.current.length; i++) {
          intervals.push(beatHistory.current[i] - beatHistory.current[i - 1]);
        }
        
        intervals.sort((a, b) => a - b);
        const trimmedIntervals = intervals.slice(1, -1); // Remove highest and lowest
        
        if (trimmedIntervals.length > 0) {
          const avgInterval = trimmedIntervals.reduce((sum, val) => sum + val, 0) / trimmedIntervals.length;
          const rawBPM = Math.round(60000 / avgInterval);
          
          if (rawBPM >= 30 && rawBPM <= 300) {
            bpmSmoothingBuffer.current.push(rawBPM);
            if (bpmSmoothingBuffer.current.length > 8) {
              bpmSmoothingBuffer.current.shift();
            }
            
            const weights = bpmSmoothingBuffer.current.map((_, i) => i + 1); // Recent values have higher weight
            const weightedSum = bpmSmoothingBuffer.current.reduce((sum, bpm, i) => sum + bpm * weights[i], 0);
            const totalWeight = weights.reduce((sum, w) => sum + w, 0);
            const newSmoothedBPM = Math.round(weightedSum / totalWeight);
            
            smoothedBPM.current = smoothedBPM.current === 0 ? newSmoothedBPM : 
              Math.round(smoothedBPM.current * 0.7 + newSmoothedBPM * 0.3);
            
            setCurrentBPM(smoothedBPM.current);
            setBpmHistory(prev => {
              const newHistory = [...prev, smoothedBPM.current];
              return newHistory.slice(-50); // Reduced for better performance
            });
          }
        }
      }
    }
    
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(20, 0, 0, 0.9)';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.2)';
    ctx.lineWidth = 1;
    
    for (let bpm = 60; bpm <= 180; bpm += 20) {
      const y = height - ((bpm - 60) / 120) * height * 0.8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      
      ctx.fillStyle = 'rgba(255, 100, 100, 0.6)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${bpm}`, 5, y - 2);
    }
    
    if (bpmHistory.length > 2) {
      ctx.strokeStyle = '#FF4444';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#FF4444';
      ctx.shadowBlur = 5;
      
      ctx.beginPath();
      
      const firstX = 0;
      const firstBpm = bpmHistory[0];
      const firstY = height - ((firstBpm - 60) / 120) * height * 0.8;
      ctx.moveTo(firstX, firstY);
      
      for (let i = 1; i < bpmHistory.length - 1; i++) {
        const x = (i / (bpmHistory.length - 1)) * width;
        const nextX = ((i + 1) / (bpmHistory.length - 1)) * width;
        const bpm = bpmHistory[i];
        const nextBpm = bpmHistory[i + 1];
        
        const y = height - ((bpm - 60) / 120) * height * 0.8;
        const nextY = height - ((nextBpm - 60) / 120) * height * 0.8;
        
        const controlX = x + (nextX - x) * 0.5;
        const controlY = y;
        
        ctx.quadraticCurveTo(controlX, controlY, nextX, nextY);
      }
      
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#FF4444';
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    
    ctx.fillStyle = '#FF6666';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#FF6666';
    ctx.shadowBlur = 8;
    ctx.fillText(`${currentBPM} BPM`, width / 2, 25);
    ctx.shadowBlur = 0;
    

  }, [bpmHistory, currentBPM]);

  const drawOscilloscope = useCallback((ctx: CanvasRenderingContext2D, data: Uint8Array) => {
    const canvas = ctx.canvas;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    if (width === 0 || height === 0) return;
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.2)';
    ctx.lineWidth = 1;
    
    const gridSpacing = width / 10;
    for (let x = 0; x <= width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    const vGridSpacing = height / 8;
    for (let y = 0; y <= height; y += vGridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    ctx.strokeStyle = '#00FF88';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00FF88';
    ctx.shadowBlur = 4;
    
    ctx.beginPath();
    
    const samples = Math.min(data.length, width);
    const centerY = height / 2;
    const amplitude = height * 0.3;
    
    for (let i = 0; i < samples; i++) {
      const x = (i / samples) * width;
      
      let signal = (data[i] - 127.5) / 127.5; // Normalize to -1 to 1
      
      if (Math.abs(signal) < 0.1) {
        signal += Math.sin(timeRef.current * 0.005 + i * 0.1) * 0.2;
      }
      
      const y = centerY - (signal * amplitude);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
    ctx.shadowBlur = 0;
    

    
    ctx.fillStyle = 'rgba(0, 255, 136, 0.7)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    
  }, []);

  const drawMatrix = useCallback((ctx: CanvasRenderingContext2D, data: Uint8Array) => {
    const canvas = ctx.canvas;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    if (width === 0 || height === 0) return;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, width, height);
    
    const columns = Math.max(1, Math.floor(width / 20));
    const columnWidth = width / columns;
    
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    
    for (let i = 0; i < columns; i++) {
      const dataIndex = Math.floor((i / columns) * data.length);
      let intensity = data[dataIndex] / 255;
      
      intensity = Math.max(intensity, 0.3);
      
      const chars = '01ABCDEF※∞◊◈⌘⚡◆◇';
      const char = chars[Math.floor(Math.random() * chars.length)];
      
      const x = i * columnWidth + columnWidth / 2;
      const y = (timeRef.current * 0.03 * intensity + i * 25) % (height + 30);
      
      ctx.fillStyle = `rgba(0, 255, 136, ${intensity * 0.8 + 0.2})`;
      ctx.shadowColor = '#00FF88';
      ctx.shadowBlur = 6;
      ctx.fillText(char, x, y);
    }
    ctx.shadowBlur = 0;
  }, []);

  const drawAIFallback = useCallback((ctx: CanvasRenderingContext2D, data: Uint8Array) => {
    const canvas = ctx.canvas;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    if (width === 0 || height === 0) return;
    
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(0, 0, 20, 0.9)';
    ctx.fillRect(0, 0, width, height);
    
    const centerX = width / 2;
    const centerY = height / 2;
    
    const averageFreq = data.reduce((sum, val) => sum + val, 0) / data.length;
    let normalizedFreq = averageFreq / 255;
    
    normalizedFreq = Math.max(normalizedFreq, 0.3 + Math.sin(timeRef.current * 0.002) * 0.2);
    
    const radius = 30 + normalizedFreq * 40;
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    
    for (let i = 0; i < 8; i++) {
      const angle = (timeRef.current * 0.001 + i * Math.PI / 4) % (Math.PI * 2);
      const orbitRadius = 50 + normalizedFreq * 25;
      const x = centerX + Math.cos(angle) * orbitRadius;
      const y = centerY + Math.sin(angle) * orbitRadius;
      
      ctx.fillStyle = '#00FFFF';
      ctx.shadowColor = '#00FFFF';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }, []);

  const executeGeneratedCode = useCallback((code: string): GeneratedVisualization['drawFunction'] | null => {
    try {
      const dangerousPatterns = [
        /eval\s*\(/gi,
        /Function\s*\(/gi,
        /setTimeout\s*\(/gi,
        /setInterval\s*\(/gi,
        /fetch\s*\(/gi,
        /XMLHttpRequest/gi,
        /localStorage/gi,
        /sessionStorage/gi,
        /document\./gi,
        /window\./gi,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
          throw new Error('Generated code contains potentially unsafe operations');
        }
      }

      const drawFunction = new Function(
        'ctx',
        'frequencyData', 
        'canvas',
        'timeRef',
        'Math',
        `"use strict"; ${code}`
      );

      const testCanvas = document.createElement('canvas');
      const testCtx = testCanvas.getContext('2d');
      const testData = new Uint8Array(128).fill(100);
      const testTimeRef = { current: 0 };
      
      if (testCtx) {
        drawFunction(testCtx, testData, testCanvas, testTimeRef, Math);
      }

      return (ctx, frequencyData, canvas, timeRef) => {
        drawFunction(ctx, frequencyData, canvas, timeRef, Math);
      };
    } catch (error) {
      console.error('Code execution failed:', error);
      return null;
    }
  }, []);

  const handleGenerate = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-visualization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const drawFunction = executeGeneratedCode(data.code);
      
      if (!drawFunction) {
        throw new Error('Generated code could not be executed safely');
      }

      setSavedVisualizations(prev => [...prev, {
        prompt,
        code: data.code,
        drawFunction,
      }]);

      setCurrentIndex(savedVisualizations.length);
      setShowPromptInterface(false);
    } catch (error) {
      console.error('Visualization generation failed:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
    }
  }, [executeGeneratedCode, savedVisualizations]);

  const animate = useCallback(() => {
    const step = (timestamp: number) => {
      timeRef.current = timestamp;

      if (!isActive) {
        animationRef.current = requestAnimationFrame(step);
        return;
      }

      const audioData = frequencyData || new Uint8Array(128).fill(0);

      calculateAudioStats(audioData);

      const canvases = [
        { ref: spectrumCanvasRef, draw: drawSpectrum, name: 'spectrum' },
        { ref: bpmCanvasRef, draw: drawBPM, name: 'bpm' },
        { ref: oscilloscopeCanvasRef, draw: drawOscilloscope, name: 'oscilloscope' },
        { ref: matrixCanvasRef, draw: drawMatrix, name: 'matrix' },
      ];

      canvases.forEach(({ ref, draw, name }) => {
        const canvas = ref.current;
        const ctx = canvas?.getContext('2d');
        
        
        if (canvas && ctx) {
          try {
            const rect = canvas.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              canvas.width = rect.width;
              canvas.height = rect.height;
              
              ctx.fillStyle = 'red';
              ctx.fillRect(10, 10, 50, 50);
              
              draw(ctx, audioData);
            } else {
              console.warn(`Canvas ${name} has zero size:`, rect);
              canvas.width = 200;
              canvas.height = 150;
              ctx.fillStyle = 'blue';
              ctx.fillRect(0, 0, 200, 150);
            }
          } catch (error) {
            console.error(`Error drawing ${name} visualization:`, error);
          }
        } 
      });

      const currentVis = currentIndexRef.current >= 0 ? savedVisualizationsRef.current[currentIndexRef.current] : null;
      const aiCanvas = aiCanvasRef.current;
      const aiCtx = aiCanvas?.getContext('2d');
      if (aiCanvas && aiCtx) {
        try {
          if (currentVis?.drawFunction && frequencyData) {
            currentVis.drawFunction(aiCtx, frequencyData, aiCanvas, timeRef);
          } else {
            drawAIFallback(aiCtx, audioData);
          }
        } catch (error) {
          console.error('Error drawing AI visualization:', error);
          drawAIFallback(aiCtx, audioData);
        }
      }

      animationRef.current = requestAnimationFrame(step);
    };

    return step;
  }, [isActive, frequencyData, calculateAudioStats, drawSpectrum, drawBPM, drawOscilloscope, drawMatrix, drawAIFallback]);

  useEffect(() => {
    const cleanups = [
      aiCanvasRef,
      spectrumCanvasRef,
      bpmCanvasRef,
      oscilloscopeCanvasRef,
      matrixCanvasRef
    ].map(ref => initCanvas(ref.current));

    if (isActive) {
      const animateStep = animate();
      animationRef.current = requestAnimationFrame(animateStep);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      cleanups.forEach(cleanup => cleanup && cleanup());
    };
  }, [initCanvas, animate, isActive]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isActive) return;
      
      switch (event.key) {
        case 'Enter':
          if (!showPromptInterface) setShowPromptInterface(true);
          break;
        case 'Escape':
          if (showPromptInterface) {
            setShowPromptInterface(false);
          } else {
            onExit();
          }
          break;
        case 'ArrowLeft':
          if (savedVisualizations.length > 0) {
            setCurrentIndex(prev => prev <= 0 ? savedVisualizations.length - 1 : prev - 1);
          }
          break;
        case 'ArrowRight':
          if (savedVisualizations.length > 0) {
            setCurrentIndex(prev => (prev + 1) % savedVisualizations.length);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, showPromptInterface, savedVisualizations.length, onExit]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-black grid-bg">
      <div className="h-screen p-2 grid grid-cols-3 grid-rows-3 gap-1">
        
        <div className="panel panel-corners rounded-lg p-2 col-span-1 row-span-1 flex flex-col">
          <div className="flex items-center justify-between mb-1 flex-shrink-0">
          </div>
          <div className="flex-1 relative overflow-hidden rounded">
            <canvas 
              ref={spectrumCanvasRef}
              className="absolute inset-0 w-full h-full rounded bg-gray-900"
            />
          </div>
        </div>

        <div className="panel panel-corners rounded-lg p-2 col-span-1 row-span-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-1 flex-shrink-0">
          </div>
          <div className="flex-1 flex flex-col justify-between min-h-0 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">VOL</span>
                <span className="text-cyan-300 font-mono">{Math.round(audioStats.volume * 100)}%</span>
              </div>
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-0"
                  style={{ width: `${audioStats.volume * 100}%` }}
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">BASS</span>
                <span className="text-orange-300 font-mono">{Math.round(audioStats.bass * 100)}%</span>
              </div>
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-400 to-orange-500 transition-all duration-0"
                  style={{ width: `${audioStats.bass * 100}%` }}
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">MID</span>
                <span className="text-green-300 font-mono">{Math.round(audioStats.mid * 100)}%</span>
              </div>
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-400 to-green-500 transition-all duration-0"
                  style={{ width: `${audioStats.mid * 100}%` }}
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">TREB</span>
                <span className="text-purple-300 font-mono">{Math.round(audioStats.treble * 100)}%</span>
              </div>
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-0"
                  style={{ width: `${audioStats.treble * 100}%` }}
                />
              </div>
            </div>
            

          </div>
        </div>

        <div className="panel panel-corners rounded-lg p-2 col-span-1 row-span-1 flex flex-col">
          <div className="flex items-center justify-between mb-1 flex-shrink-0">
          </div>
          <div className="flex-1 relative overflow-hidden rounded">
            <canvas 
              ref={bpmCanvasRef}
              className="absolute inset-0 w-full h-full rounded bg-gray-900"
            />
          </div>
        </div>

        <div className="panel panel-corners rounded-lg p-2 col-span-2 row-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-1 flex-shrink-0">
            <h3 className="text-futuristic text-xs text-cyan-400">
              {currentVisualization && (
                <span className="text-xs text-gray-400 ml-2">
                  [{currentIndex + 1}/{savedVisualizations.length}]
                </span>
              )}
            </h3>
            <div className="flex items-center space-x-2 cursor-pointer">
              <button
                onClick={() => setShowPromptInterface(true)}
                className="btn-primary px-2 py-1 text-xs rounded cursor-pointer"
              >
                GENERATE
              </button>
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden rounded border border-cyan-400/20">
            <canvas 
              ref={aiCanvasRef}
              className="absolute inset-0 w-full h-full rounded bg-gray-900"
            />
          </div>
          {currentVisualization && (
            <div className="mt-1 text-xs text-gray-400 flicker truncate flex-shrink-0">
              ACTIVE: {currentVisualization.prompt}
            </div>
          )}
        </div>

        <div className="panel panel-corners rounded-lg p-2 col-span-1 row-span-1 flex flex-col">
          <div className="flex items-center justify-between mb-1 flex-shrink-0">
          </div>
          <div className="flex-1 relative overflow-hidden rounded">
            <canvas 
              ref={oscilloscopeCanvasRef}
              className="absolute inset-0 w-full h-full rounded bg-black"
            />
          </div>
        </div>

        <div className="panel panel-corners rounded-lg p-2 col-span-1 row-span-1 flex flex-col">
          <div className="flex items-center justify-between mb-1 flex-shrink-0">
          </div>
          <div className="flex-1 relative overflow-hidden rounded bg-gray-900">
            <div className="absolute inset-0 p-1">
              <div className="grid grid-cols-40 grid-rows-16 gap-0 w-full h-full">
                {heatmapData.map((frame, frameIndex) => 
                  frame.map((magnitude, binIndex) => (
                    <div
                      key={`${frameIndex}-${binIndex}`}
                      className={`w-full h-full ${getHeatmapColor(magnitude)}`}
                      style={{ 
                        gridColumn: frameIndex + 1,
                        gridRow: binIndex + 1,
                        opacity: Math.max(magnitude / 255, 0.1)
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="panel rounded-lg px-6 py-3">
          <div className="flex items-center justify-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-cyan-400 rounded-full pulse-glow"></div>
              <span className="text-data text-cyan-300">ENTER</span>
              <span className="text-gray-400">AI Interface</span>
            </div>
            <div className="w-px h-4 bg-cyan-400/30"></div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-400 rounded-full pulse-glow"></div>
              <span className="text-data text-red-300">ESC</span>
              <span className="text-gray-400">Exit</span>
            </div>
            {savedVisualizations.length > 0 && (
              <>
                <div className="w-px h-4 bg-cyan-400/30"></div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full pulse-glow"></div>
                  <span className="text-data text-blue-300">←→</span>
                  <span className="text-gray-400">Navigate</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <PromptInterface
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        isVisible={showPromptInterface}
      />

      {error && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 max-w-lg">
          <div className="panel rounded-lg p-4 border-red-500">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center mr-3 pulse-glow">
                <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
              </div>
              <h3 className="text-futuristic text-red-400">GENERATION ERROR</h3>
            </div>
            <div className="text-data text-red-300 mb-4 cursor-pointer" >{error}</div>
            <button
              onClick={() => setError(null)}
              className="btn-primary w-full py-2 px-4 rounded border-red-500 hover:border-red-400 cursor-pointer"
            >
              <span className="text-xs">ACKNOWLEDGE</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}; 

