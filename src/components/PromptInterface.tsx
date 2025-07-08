import { useState } from 'react';

interface PromptInterfaceProps {
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
  isVisible: boolean;
}

export const PromptInterface: React.FC<PromptInterfaceProps> = ({
  onGenerate,
  isGenerating,
  isVisible,
}) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isGenerating) {
      onGenerate(prompt.trim());
      setPrompt(''); // Clear input after submission
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
      <div className="panel panel-corners rounded-lg p-6 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-center mb-2">
            <div className="w-3 h-3 bg-cyan-400 rounded-full mr-2 pulse-glow"></div>
            <span className="text-futuristic text-sm text-cyan-400">WAVECRAFT INTERFACE</span>
            <div className="w-3 h-3 bg-cyan-400 rounded-full ml-2 pulse-glow"></div>
          </div>
          <div className="text-xs text-gray-400 flicker">
            [ DESCRIBE YOUR MATRIX ]
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={isGenerating ? "PROCESSING..." : "Enter visualization parameters..."}
              className="input-primary w-full px-6 py-4 rounded-lg text-center text-lg"
              disabled={isGenerating}
              autoFocus
            />
            {isGenerating && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>


        </form>

        {/* Additional Info */}
        <div className="mt-4 pt-4 border-t border-cyan-400/20">
          <div className="text-center text-xs text-gray-500">
            Press ENTER to execute • ESC to close interface
          </div>
        </div>
      </div>
    </div>
  );
}; 