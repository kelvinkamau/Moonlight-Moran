import React, { useState, useEffect, useRef } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameState } from './types';
import { initAudio } from './utils/sound';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState<number>(0);
  const [collectiblesCount, setCollectiblesCount] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [highScoreCoins, setHighScoreCoins] = useState<number>(0);
  const [causeOfDeath, setCauseOfDeath] = useState<string>('');
  const [recoverSignal, setRecoverSignal] = useState<number>(0);

  // Session ID to force re-mount of GameCanvas on Restart
  const [gameSessionId, setGameSessionId] = useState<number>(0);

  const startGame = () => {
    initAudio();
    setGameSessionId(prev => prev + 1); // Reset game canvas
    setGameState(GameState.PLAYING);
    setScore(0);
    setCollectiblesCount(0);
  };

  const recoverGame = () => {
    if (collectiblesCount >= 40) {
      setRecoverSignal(prev => prev + 1);
      setGameState(GameState.PLAYING);
    }
  };

  const handleGameOver = async (finalScore: number, finalCoins: number, cause: string) => {
    setGameState(GameState.GAME_OVER);
    setCauseOfDeath(cause);

    // Update High Scores
    if (finalScore > highScore) {
      setHighScore(finalScore);
    }
    if (finalCoins > highScoreCoins) {
      setHighScoreCoins(finalCoins);
    }
  };

  const togglePause = () => {
    if (gameState === GameState.PLAYING) {
      setGameState(GameState.PAUSED);
    } else if (gameState === GameState.PAUSED) {
      setGameState(GameState.PLAYING);
    }
  };

  // Global Input Handling for Start/Pause
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Spacebar controls
      if (e.code === 'Space') {
        e.preventDefault(); // Prevent scrolling

        if (gameState === GameState.MENU || gameState === GameState.GAME_OVER) {
          startGame();
        } else {
          togglePause();
        }
      }
    };

    const handleTouch = (e: TouchEvent) => {
      if (gameState === GameState.MENU || gameState === GameState.GAME_OVER) {
        // Only prevent default if we are actually handling it, to avoid breaking other touch interactions
        if (e.target instanceof HTMLButtonElement) return; // Let buttons handle their own clicks
        e.preventDefault();
        startGame();
      }
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('touchstart', handleTouch, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('touchstart', handleTouch);
    };
  }, [gameState]);

  return (
      <div className="relative w-screen h-screen bg-slate-950 flex items-center justify-center overflow-hidden">

        {/* Game Canvas Layer - Keyed by sessionId to ensure fresh start */}
        <div className="absolute inset-0 z-0">
          <GameCanvas
              key={gameSessionId}
              gameState={gameState}
              onGameOver={handleGameOver}
              setScore={setScore}
              setCollectiblesCount={setCollectiblesCount}
              recoverSignal={recoverSignal}
          />
        </div>

        {/* HUD Layer (Visible when playing or paused) */}
        {(gameState === GameState.PLAYING || gameState === GameState.PAUSED) && (
            <>
              {/* Left and Right HUD elements */}
              <div className="absolute top-0 left-0 w-full p-4 md:p-6 flex justify-between items-start z-10 pointer-events-none">
                <div className="flex flex-col">
                  <span className="text-blue-200 text-xs md:text-sm tracking-widest uppercase">Distance</span>
                  <span className="text-2xl md:text-4xl font-bold text-white font-mono">{score}m</span>
                </div>

                <div className="flex flex-col text-right gap-1">
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[10px] md:text-xs tracking-widest uppercase">Best Dist</span>
                    <span className="text-sm md:text-xl font-bold text-slate-300 font-mono">{highScore}m</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[10px] md:text-xs tracking-widest uppercase">Best Coins</span>
                    <span className="text-sm md:text-xl font-bold text-yellow-500/80 font-mono">{highScoreCoins}</span>
                  </div>
                </div>
              </div>

              {/* Center HUD (Coins) - Positioned absolutely in the center */}
              <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex flex-col items-center">
                <span className="text-yellow-200 text-xs md:text-sm tracking-widest uppercase">Coins</span>
                <span className="text-2xl md:text-4xl font-bold text-yellow-400 font-mono">{collectiblesCount}</span>
              </div>
            </>
        )}

        {/* Pause Overlay */}
        {gameState === GameState.PAUSED && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
              <h2 className="text-5xl font-bold text-white mb-4 tracking-[0.2em] drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                PAUSED
              </h2>
              <p className="text-slate-300 uppercase tracking-widest text-sm animate-pulse">
                Press Space to Resume
              </p>
            </div>
        )}

        {/* Menu Overlay */}
        {gameState === GameState.MENU && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
              <h1 className="text-[40px] md:text-[76px] font-black text-transparent bg-clip-text bg-gradient-to-br from-red-500 to-orange-100 tracking-tighter mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                MOONLIGHT MORAN
              </h1>
              <p className="text-slate-300 mb-12 text-lg tracking-wider font-light">
                The savanna awaits. Run like the wind.
              </p>
              <button
                  onClick={startGame}
                  className="group relative px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold text-xl tracking-widest uppercase transition-all duration-300 clip-path-polygon hover:scale-105 hover:shadow-[0_0_25px_rgba(220,38,38,0.6)]"
                  style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}
              >
                Start Run
                <div className="absolute inset-0 border-2 border-white/20 group-hover:border-white/50 transition-colors pointer-events-none" style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}></div>
              </button>

              <div className="mt-12 flex gap-8 text-slate-400 text-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-1">
                    <kbd className="w-10 h-10 inline-flex items-center justify-center bg-slate-800 border border-slate-700 border-b-[4px] border-b-slate-900 rounded-md text-slate-300 font-mono text-sm font-bold shadow-sm">↑</kbd>
                  </div>
                  <span className="uppercase tracking-widest text-xs">Jump (x3)</span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-1">
                    <kbd className="px-6 h-10 inline-flex items-center justify-center bg-slate-800 border border-slate-700 border-b-[4px] border-b-slate-900 rounded-md text-slate-300 font-mono text-sm font-bold shadow-sm">SPACE</kbd>
                  </div>
                  <span className="uppercase tracking-widest text-xs">Pause</span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-1">
                    <kbd className="w-10 h-10 inline-flex items-center justify-center bg-slate-800 border border-slate-700 border-b-[4px] border-b-slate-900 rounded-md text-slate-300 font-mono text-sm font-bold shadow-sm">←</kbd>
                  </div>
                  <span className="uppercase tracking-widest text-xs">Back</span>
                </div>
              </div>
            </div>
        )}

        {/* Game Over Overlay */}
        {gameState === GameState.GAME_OVER && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
              <h2 className="text-4xl md:text-5xl font-bold text-red-500 mb-2 tracking-widest drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                DEFEAT
              </h2>
              <p className="text-slate-400 mb-6 md:mb-8 uppercase text-xs md:text-sm tracking-widest">
                {causeOfDeath}
              </p>

              <div className="flex gap-8 md:gap-12 mb-6 md:mb-8">
                <div className="flex flex-col items-center">
                  <span className="text-slate-500 text-[10px] md:text-xs uppercase tracking-widest mb-1">Score</span>
                  <span className="text-2xl md:text-3xl font-mono text-white">{score}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-slate-500 text-[10px] md:text-xs uppercase tracking-widest mb-1">Coins</span>
                  <span className="text-2xl md:text-3xl font-mono text-yellow-400">{collectiblesCount}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:gap-4 items-center">
                <button
                    onClick={startGame}
                    className="px-6 md:px-8 py-2 md:py-3 bg-slate-100 hover:bg-white text-slate-900 font-bold text-base md:text-lg tracking-widest uppercase transition-all duration-200 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] w-56 md:w-64"
                >
                  Try Again
                </button>
                <button
                    onClick={recoverGame}
                    disabled={collectiblesCount < 40}
                    className={`px-6 md:px-8 py-2 md:py-3 font-bold text-base md:text-lg tracking-widest uppercase transition-all duration-200 w-56 md:w-64 flex items-center justify-center gap-2 whitespace-nowrap ${
                        collectiblesCount >= 40
                            ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-900 hover:shadow-[0_0_20px_rgba(234,179,8,0.4)]'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                >
                  Recover (-40 <span className="text-xs md:text-sm">🟡</span>)
                </button>
              </div>
              <p className="mt-4 md:mt-6 text-slate-500 text-[10px] md:text-xs uppercase tracking-widest">
                Press Space to Retry
              </p>

              <div className="mt-8 md:mt-12 flex gap-4 md:gap-8 text-slate-500 text-sm opacity-80 scale-75 md:scale-100 origin-top">
                <div className="flex flex-col items-center gap-2 md:gap-3">
                  <div className="flex gap-1">
                    <kbd className="w-8 h-8 md:w-10 md:h-10 inline-flex items-center justify-center bg-slate-800 border border-slate-700 border-b-[3px] md:border-b-[4px] border-b-slate-900 rounded-md text-slate-300 font-mono text-xs md:text-sm font-bold shadow-sm">↑</kbd>
                  </div>
                  <span className="uppercase tracking-widest text-[10px] md:text-xs">Jump (x3)</span>
                </div>
                <div className="flex flex-col items-center gap-2 md:gap-3">
                  <div className="flex gap-1">
                    <kbd className="px-4 md:px-6 h-8 md:h-10 inline-flex items-center justify-center bg-slate-800 border border-slate-700 border-b-[3px] md:border-b-[4px] border-b-slate-900 rounded-md text-slate-300 font-mono text-xs md:text-sm font-bold shadow-sm">SPACE</kbd>
                  </div>
                  <span className="uppercase tracking-widest text-[10px] md:text-xs">Pause</span>
                </div>
                <div className="flex flex-col items-center gap-2 md:gap-3">
                  <div className="flex gap-1">
                    <kbd className="w-8 h-8 md:w-10 md:h-10 inline-flex items-center justify-center bg-slate-800 border border-slate-700 border-b-[3px] md:border-b-[4px] border-b-slate-900 rounded-md text-slate-300 font-mono text-xs md:text-sm font-bold shadow-sm">←</kbd>
                  </div>
                  <span className="uppercase tracking-widest text-[10px] md:text-xs">Back</span>
                </div>
              </div>

              <div className="absolute bottom-8 text-slate-500 text-xs tracking-widest uppercase">
                Made by Kamau
              </div>
            </div>
        )}
      </div>
  );
};

export default App;