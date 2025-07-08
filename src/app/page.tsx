"use client";

import React, { useState, useRef } from 'react';
import { useAudioAnalyser } from '../hooks/useAudioAnalyser';
import { AIGeneratedVisualizer } from '../components/AIGeneratedVisualizer';

export default function Home() {
  const audioDebug = useAudioAnalyser();
  const {
    isCapturing,
    error,
    startCapture,
    startSampleAudio,
    startFileAudio,
    stopCapture,
  } = audioDebug;

  const [, setHasStarted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTabStart = async () => {
    try {
      const canvas = document.querySelector('canvas');
      if (canvas && canvas.requestFullscreen) {
        await canvas.requestFullscreen();
      }
      setHasStarted(true);
      await startCapture();
    } catch (e) {
      console.error('Error in handleTabStart:', e);
    } 
  };

  const handleSampleStart = async () => {
    try {
      const canvas = document.querySelector('canvas');
      if (canvas && canvas.requestFullscreen) {
        await canvas.requestFullscreen();
      }
      setHasStarted(true);
      await startSampleAudio();
    } catch (e) {
      console.error('Error in handleSampleStart:', e);
    }
  };

  const handleFileStart = async (file: File) => {
    try {
      const canvas = document.querySelector('canvas');
      if (canvas && canvas.requestFullscreen) {
        await canvas.requestFullscreen();
      }
      setHasStarted(true);
      await startFileAudio(file);
    } catch (e) {
      console.error('Error in handleFileStart:', e);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileStart(file);
    }
  };

  const handleExit = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      stopCapture();
    } catch (e) {
      console.error('Error in handleExit:', e);
    }
  };

  return (
    <main className="min-h-screen bg-black grid-bg relative overflow-hidden">
      {/* Background Grid Overlay */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="w-full h-full" style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}></div>
      </div>

      {!isCapturing && !error && (
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
          {/* Main Interface Panel */}
          <div className="panel panel-corners rounded-lg p-8 max-w-4xl w-full">
            {/* Header Section */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center mr-4 pulse-glow">
                  <div className="w-6 h-6 bg-white rounded-full"></div>
                </div>
                <h1 className="text-futuristic text-4xl text-cyan-400 glow-text">
                  AI-WAVES
                </h1>
              </div>
              <div className="text-data text-lg text-gray-300 mb-2">
              Artificial Immersion in Waveform Activity & Visual Emotion Signals
              </div>
              <div className="text-sm text-cyan-300 flicker">
                [ SYSTEM STATUS: READY ]
              </div>
            </div>

            {/* Status Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="glass-effect rounded-lg p-4 border-l-4 border-l-cyan-400">
                <div className="text-xs text-gray-400 mb-1">AUDIO ENGINE</div>
                <div className="text-data text-lg status-active">ONLINE</div>
              </div>
              <div className="glass-effect rounded-lg p-4 border-l-4 border-l-blue-500">
                <div className="text-xs text-gray-400 mb-1">VISUAL MATRIX</div>
                <div className="text-data text-lg status-active">STANDBY</div>
              </div>
              <div className="glass-effect rounded-lg p-4 border-l-4 border-l-green-400">
                <div className="text-xs text-gray-400 mb-1">AI CORE</div>
                <div className="text-data text-lg status-active">READY</div>
              </div>
            </div>

            {/* Control Section */}
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-futuristic text-xl text-cyan-300 mb-6">
                  INITIALIZE AUDIO SOURCE
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Sample Audio Button */}
                <div className="group">
                  <button
                    className="btn-primary w-full py-4 px-6 rounded-lg transition-all duration-300 group-hover:scale-105 cursor-pointer"
                    onClick={handleSampleStart}
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <svg className="w-8 h-8 text-cyan-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8 5v10l8-5-8-5z"/>
                      </svg>
                      <span className="text-sm">SAMPLE TRACK</span>
                      <span className="text-xs text-gray-400">DEMO AUDIO</span>
                    </div>
                  </button>
                </div>

                {/* File Upload Button */}
                <div className="group" >
                  <button
                    className="btn-primary w-full py-4 px-6 rounded-lg transition-all duration-300 group-hover:scale-105 cursor-pointer"
                    onClick={handleFileSelect}
                    
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <svg className="w-8 h-8 text-cyan-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
                      </svg>
                      <span className="text-sm">UPLOAD FILE</span>
                      <span className="text-xs text-gray-400">LOCAL AUDIO</span>
                    </div>
                  </button>
                </div>

                {/* Tab Audio Button */}
                <div className="group">
                  <button
                    className="btn-primary w-full py-4 px-6 rounded-lg transition-all duration-300 group-hover:scale-105 cursor-pointer"
                    onClick={handleTabStart}
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <svg className="w-8 h-8 text-cyan-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                      </svg>
                      <span className="text-sm">TAB AUDIO</span>
                      <span className="text-xs text-gray-400">LIVE CAPTURE</span>
                    </div>
                  </button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>


          </div>

          {/* Developer Signature */}
          <div className="mt-8 flex items-center justify-center">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative px-6 py-3 bg-black rounded-lg border border-cyan-400/30 group-hover:border-cyan-400/60 transition-all duration-300">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                  <span className="text-futuristic text-sm text-cyan-400/80 group-hover:text-cyan-300 transition-colors duration-300">
                    CRAFTED BY 
                  </span>
                  <a 
                    href="https://dramsammy.dev" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-data text-cyan-300 hover:text-white transition-colors duration-300 glow-text-subtle"
                  >
                    DRAMSAMMY.DEV
                  </a>
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
          <div className="panel panel-corners rounded-lg p-8 max-w-2xl w-full border-red-500">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 pulse-glow">
                <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
              </div>
              <h2 className="text-futuristic text-xl text-red-400 mb-4">SYSTEM ERROR</h2>
              <p className="text-data text-red-300 mb-6">{error}</p>
              <button
                className="btn-primary px-8 py-3 rounded-lg border-red-500 hover:border-red-400 cursor-pointer"
                onClick={() => window.location.reload()}
              >
                <span className="text-sm">RESTART SYSTEM</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isCapturing && (
        <AIGeneratedVisualizer 
          frequencyData={audioDebug.frequencyData} 
          isActive={isCapturing}
          onExit={handleExit}
        />
      )}
    </main>
  );
}
