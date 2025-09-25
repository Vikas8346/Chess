import { NextApiRequest, NextApiResponse } from 'next';

const sessions: Record<string, { 
  players: string[]; // Store player IDs instead of response objects
  board: string; 
  turn: string;
  playerColors: Record<string, string>; // Map player ID to color
}> = {};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method, body, query } = req;
  
  // Enable CORS and SSE headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (method === 'POST') {
    const { type, sessionId, board, color } = body;
    
    if (type === 'create') {
      const newSessionId = Math.random().toString(36).substr(2, 6);
      sessions[newSessionId] = { 
        players: [], 
        board: board || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        turn: 'w',
        playerColors: {}
      };
      res.json({ type: 'created', sessionId: newSessionId });
      return;
    }
    
    if (type === 'join') {
      const { playerId } = body;
      const session = sessions[sessionId];
      if (!session) {
        res.json({ type: 'error', message: 'Session not found' });
        return;
      }
      if (session.players.length >= 2) {
        res.json({ type: 'error', message: 'Session full' });
        return;
      }
      
      const playerColor = session.players.length === 0 ? 'w' : 'b';
      const playerIdToUse = playerId || `player_${Math.random().toString(36).substr(2, 9)}`;
      
      if (!session.players.includes(playerIdToUse)) {
        session.players.push(playerIdToUse);
        session.playerColors[playerIdToUse] = playerColor;
      }
      
      res.json({ 
        type: 'joined', 
        sessionId, 
        board: session.board,
        color: session.playerColors[playerIdToUse],
        playerId: playerIdToUse
      });
      return;
    }
    
    if (type === 'move') {
      const session = sessions[sessionId];
      if (session) {
        session.board = board;
        session.turn = session.turn === 'w' ? 'b' : 'w';
        // In a real app, you'd notify other players here
        res.json({ type: 'move-received', board: session.board });
        return;
      }
    }
  }
  
  if (method === 'GET') {
    const { sessionId } = query;
    const session = sessions[sessionId as string];
    
    if (session) {
      res.json({ 
        board: session.board,
        turn: session.turn,
        players: session.players.length 
      });
    } else {
      res.json({ error: 'Session not found' });
    }
    return;
  }
  
  res.status(405).json({ error: 'Method not allowed' });
}