
"use client";

import { useEffect, useRef, useState } from 'react';
import { Chess, type PieceSymbol, type Color } from 'chess.js';

function getSession() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('chess-session') || '';
}

function setSession(sessionId: string, color: string, playerId: string) {
  localStorage.setItem('chess-session', sessionId);
  localStorage.setItem('chess-color', color);
  localStorage.setItem('chess-player-id', playerId);
}

function getColor() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('chess-color') || '';
}

function getPlayerId() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('chess-player-id') || '';
}

export default function Home() {
  const [step, setStep] = useState<'lobby' | 'board'>('lobby');
  const [sessionId, setSessionId] = useState(getSession());
  const [inputSession, setInputSession] = useState('');
  const [color, setColor] = useState(getColor());
  const [playerId, setPlayerId] = useState(getPlayerId());
  const [fen, setFen] = useState('');
  const [status, setStatus] = useState('');
  const chess = useRef<Chess>(new Chess());
  const [selected, setSelected] = useState<{ from: string | null }>({ from: null });

  useEffect(() => {
    if (sessionId && step === 'board') {
      // Poll for game state every 2 seconds
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/game?sessionId=${sessionId}`);
          const data = await response.json();
          if (data.board && data.board !== chess.current.fen()) {
            chess.current.load(data.board);
            setFen(chess.current.fen());
            setStatus(chess.current.isGameOver() ? 'Game Over' : '');
          }
        } catch (error) {
          console.error('Error polling game state:', error);
        }
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [sessionId, step]);

  async function createSession() {
    try {
      const response = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'create', board: chess.current.fen() })
      });
      const data = await response.json();
      if (data.type === 'created') {
        const newPlayerId = `player_${Math.random().toString(36).substr(2, 9)}`;
        setSession(data.sessionId, 'w', newPlayerId);
        setSessionId(data.sessionId);
        setColor('w');
        setPlayerId(newPlayerId);
        setFen(chess.current.fen());
        setStep('board');
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  }

  async function joinSession() {
    try {
      const existingPlayerId = getPlayerId();
      const playerIdToUse = existingPlayerId || `player_${Math.random().toString(36).substr(2, 9)}`;
      
      const response = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'join', sessionId: inputSession, playerId: playerIdToUse })
      });
      const data = await response.json();
      if (data.type === 'joined') {
        setSession(inputSession, data.color, data.playerId);
        setSessionId(inputSession);
        setColor(data.color);
        setPlayerId(data.playerId);
        chess.current.load(data.board);
        setFen(chess.current.fen());
        setStep('board');
      } else if (data.type === 'error') {
        alert(data.message);
      }
    } catch (error) {
      console.error('Error joining session:', error);
    }
  }

  async function handleMove(from: string, to: string) {
    if (chess.current.turn() !== color) return;
    const move = chess.current.move({ from, to, promotion: 'q' });
    if (move) {
      setFen(chess.current.fen());
      try {
        await fetch('/api/game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            type: 'move', 
            sessionId, 
            board: chess.current.fen(),
            playerId 
          })
        });
      } catch (error) {
        console.error('Error sending move:', error);
      }
      if (chess.current.isGameOver()) {
        setStatus(chess.current.isCheckmate() ? 'Checkmate!' : 'Game Over');
      }
      setSelected({ from: null });
    }
  }

  // Chess piece symbols
  const pieceSymbols: Record<string, string> = {
    'wp': '♙', 'wr': '♖', 'wn': '♘', 'wb': '♗', 'wq': '♕', 'wk': '♔',
    'bp': '♟', 'br': '♜', 'bn': '♞', 'bb': '♝', 'bq': '♛', 'bk': '♚'
  };

  // Board rendering with click-to-move
  function renderBoard() {
    const board = chess.current.board();
    return (
      <div className="grid grid-cols-8 w-96 h-96 border-4 border-gray-700 rounded-lg overflow-hidden shadow-lg">
        {board.flat().map((piece: { type: PieceSymbol; color: Color } | null, i: number) => {
          const x = i % 8;
          const y = Math.floor(i / 8);
          const isLight = (x + y) % 2 === 1;
          const square = String.fromCharCode(97 + x) + (8 - y);
          const isSelected = selected.from === square;
          const canMove = piece && piece.color === color && chess.current.turn() === color;
          
          return (
            <div
              key={i}
              className={`flex items-center justify-center text-3xl cursor-pointer select-none transition-all duration-200 hover:bg-opacity-80 ${
                isLight ? 'bg-amber-100' : 'bg-amber-800'
              } ${isSelected ? 'ring-4 ring-blue-400 bg-blue-200' : ''} ${
                canMove ? 'hover:bg-green-200' : ''
              }`}
              style={{ width: '3rem', height: '3rem' }}
              onClick={() => {
                if (selected.from) {
                  handleMove(selected.from, square);
                } else if (piece && piece.color === color && chess.current.turn() === color) {
                  setSelected({ from: square });
                }
              }}
              onDoubleClick={() => setSelected({ from: null })}
            >
              {piece ? pieceSymbols[piece.color + piece.type] || piece.type.toUpperCase() : ''}
            </div>
          );
        })}
      </div>
    );
  }

  if (step === 'lobby') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-700 text-white p-4">
        <div className="bg-gray-800 rounded-xl p-8 shadow-2xl max-w-md w-full">
          <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            ♔ Chess with Friend ♚
          </h1>
          <div className="flex flex-col gap-6">
            <button 
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg py-4 text-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105" 
              onClick={createSession}
            >
              🎯 Create New Session
            </button>
            <div className="relative">
              <div className="text-center text-gray-400 mb-3">OR</div>
              <div className="flex gap-2">
                <input
                  className="flex-1 px-4 py-3 rounded-l-lg text-black text-lg font-mono bg-gray-100 border-2 border-gray-300 focus:border-green-500 focus:outline-none"
                  placeholder="Enter Session ID..."
                  value={inputSession}
                  onChange={e => setInputSession(e.target.value.toUpperCase())}
                  maxLength={6}
                />
                <button 
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-r-lg px-6 text-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105" 
                  onClick={joinSession}
                  disabled={inputSession.length < 4}
                >
                  🚀 Join
                </button>
              </div>
            </div>
          </div>
          <div className="mt-8 text-center text-sm text-gray-400">
            Create a session and share the ID with your friend, or join an existing session to start playing!
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-700 text-white p-4">
      <div className="bg-gray-800 rounded-lg p-6 shadow-2xl">
        <h2 className="text-2xl mb-2 text-center">Session: <span className="font-mono text-blue-300">{sessionId}</span></h2>
        <div className="mb-4 text-center">
          You are playing as <span className="font-bold text-yellow-300">{color === 'w' ? 'White ♔' : 'Black ♚'}</span>
        </div>
        <div className="mb-4 text-center text-sm">
          <span className={`px-3 py-1 rounded-full ${
            chess.current.turn() === color ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {chess.current.turn() === color ? 'Your Turn' : 'Opponent\'s Turn'}
          </span>
        </div>
        {renderBoard()}
        <div className="mt-4 text-center">
          {status && <div className="text-xl font-bold text-red-400">{status}</div>}
          {chess.current.isCheck() && !chess.current.isGameOver() && (
            <div className="text-lg text-yellow-400">Check!</div>
          )}
        </div>
        <div className="mt-4 text-center text-xs text-gray-400">
          Share session ID with your friend to play together
        </div>
      </div>
    </main>
  );
}
