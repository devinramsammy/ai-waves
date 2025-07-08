import { useState, useCallback, useEffect, useRef } from 'react';

export interface AudioAnalyserDebug {
  displayStream: MediaStream | null;
  stream: MediaStream | null;
  audioTrack: MediaStreamTrack | null;
  analyser: AnalyserNode | null;
  audioContext: AudioContext | null;
  audioElement: HTMLAudioElement | null;
  error: string | null;
  isCapturing: boolean;
  mode: 'tab' | 'sample' | 'file' | null;
}

export function useAudioAnalyser() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [debug, setDebug] = useState<AudioAnalyserDebug>({
    displayStream: null,
    stream: null,
    audioTrack: null,
    analyser: null,
    audioContext: null,
    audioElement: null,
    error: null,
    isCapturing: false,
    mode: null,
  });
  const [frequencyData, setFrequencyData] = useState<Uint8Array | null>(null);

  const startCapture = useCallback(async () => {
    try {
      setDebug(d => ({ ...d, error: null }));
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
      const audioTrack = displayStream.getAudioTracks()[0] || null;
      if (!audioTrack) {
        setDebug(d => ({ ...d, error: 'No audio track found', isCapturing: false }));
        return;
      }
      const audioStream = new MediaStream([audioTrack]);
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createMediaStreamSource(audioStream);
      source.connect(analyser);
      setDebug({
        displayStream,
        stream: audioStream,
        audioTrack,
        analyser,
        audioContext: ctx,
        audioElement: null,
        error: null,
        isCapturing: true,
        mode: 'tab',
      });
      audioTrack.onended = () => {
        setDebug(d => ({ ...d, error: 'Audio track ended', isCapturing: false }));
      };
    } catch (e) {
      setDebug(d => ({ ...d, error: (e as Error).message, isCapturing: false }));
    }
  }, []);

  const startSampleAudio = useCallback(async () => {
    try {
      setDebug(d => ({ ...d, error: null }));
      
      const audio = new Audio('/loop.wav');
      audio.loop = true;
      audio.volume = 0.7;
      audioRef.current = audio;
      
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      source.connect(ctx.destination); // Connect to speakers
      
      setDebug({
        displayStream: null,
        stream: null,
        audioTrack: null,
        analyser,
        audioContext: ctx,
        audioElement: audio,
        error: null,
        isCapturing: true,
        mode: 'sample',
      });
      
      await audio.play();
      
    } catch (e) {
      setDebug(d => ({ ...d, error: (e as Error).message, isCapturing: false }));
    }
  }, []);

  const startFileAudio = useCallback(async (file: File) => {
    try {
      setDebug(d => ({ ...d, error: null }));
      
      if (!file.type.startsWith('audio/')) {
        throw new Error('Please select an audio file');
      }
      
      const audio = new Audio();
      audio.loop = true;
      audio.volume = 0.7;
      audioRef.current = audio;
      
      const fileUrl = URL.createObjectURL(file);
      audio.src = fileUrl;
      
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      source.connect(ctx.destination); // Connect to speakers
      
      setDebug({
        displayStream: null,
        stream: null,
        audioTrack: null,
        analyser,
        audioContext: ctx,
        audioElement: audio,
        error: null,
        isCapturing: true,
        mode: 'file',
      });
      
      await audio.play();
      
      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(fileUrl);
      });
      
    } catch (e) {
      setDebug(d => ({ ...d, error: (e as Error).message, isCapturing: false }));
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (debug.displayStream) debug.displayStream.getTracks().forEach(t => t.stop());
    if (debug.audioElement) {
      debug.audioElement.pause();
      debug.audioElement.currentTime = 0;
      if (debug.audioElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(debug.audioElement.src);
      }
    }
    if (debug.audioContext) debug.audioContext.close();
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current = null;
    }
    setDebug(d => ({ 
      ...d, 
      isCapturing: false, 
      mode: null,
      displayStream: null,
      stream: null,
      audioTrack: null,
      analyser: null,
      audioContext: null,
      audioElement: null,
    }));
  }, [debug.displayStream, debug.audioContext, debug.audioElement]);

  useEffect(() => {
    let raf: number | undefined;
    if (debug.analyser && debug.isCapturing) {
      const data = new Uint8Array(debug.analyser.frequencyBinCount);
      const update = () => {
        debug.analyser!.getByteFrequencyData(data);
        setFrequencyData(new Uint8Array(data));
        raf = requestAnimationFrame(update);
      };
      update();
    }
    return () => { if (raf !== undefined) cancelAnimationFrame(raf); };
  }, [debug.analyser, debug.isCapturing]);

  const usableLength = frequencyData ? Math.floor(frequencyData.length * 0.66) : 0;
  const usableFrequency = frequencyData ? frequencyData.slice(0, usableLength) : null;

  return { 
    ...debug, 
    frequencyData: usableFrequency, 
    startCapture, 
    startSampleAudio, 
    startFileAudio,
    stopCapture 
  };
}
