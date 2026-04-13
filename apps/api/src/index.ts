import { GameEventType, GameState, type Player, type RoomState, type SocketMessage, type AnonymousResponse } from "@ese/shared";
import { randomUUID } from "crypto";
import type { ServerWebSocket } from "bun";

type GameSocket = ServerWebSocket<{ nickname: string, playerId: string, isHost: boolean }>;

// Configurações do .env
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS || "10");
const MAX_ROUNDS = parseInt(process.env.MAX_ROUNDS || "5");
const MIN_PLAYERS = parseInt(process.env.MIN_PLAYERS || "2");

interface RoundResponse {
  playerId: string;
  text: string;
  votes: string[]; // IDs de quem votou nesta resposta
}

let responses: RoundResponse[] = [];
let playersWhoVoted: Set<string> = new Set();

const globalRoom: RoomState = {
  code: "GLOBAL",
  state: GameState.LOBBY,
  players: [],
  currentRound: 0,
  maxRounds: MAX_ROUNDS,
  responses: [],
};

const connectedSockets: Map<string, GameSocket> = new Map(); // playerId -> socket

const broadcastState = () => {
  const message = JSON.stringify({
    type: GameEventType.ROOM_STATE_UPDATE,
    payload: globalRoom,
  });
  for (const socket of connectedSockets.values()) {
    socket.send(message);
  }
};

const sendError = (ws: GameSocket, message: string) => {
  ws.send(JSON.stringify({ type: GameEventType.ERROR, payload: { message } }));
};

const server = Bun.serve<{ nickname: string, playerId: string, isHost: boolean }>({
  port: process.env.PORT || 3000,
  fetch(req, server) {
    const success = server.upgrade(req, {
      data: { nickname: "", playerId: randomUUID(), isHost: false }
    });
    if (success) return undefined;
    return new Response("Servidor em execução!");
  },
  websocket: {
    open(ws: GameSocket) {
      connectedSockets.set(ws.data.playerId, ws);
      ws.send(JSON.stringify({ type: "INITIAL_ID", payload: { playerId: ws.data.playerId } }));
    },
    message(ws: GameSocket, message) {
      try {
        const data = JSON.parse(message.toString()) as SocketMessage;
        
        switch (data.type) {
          case GameEventType.JOIN_ROOM:
            if (globalRoom.players.length >= MAX_PLAYERS) return sendError(ws, "Sala cheia!");
            
            const { nickname, adminPassword } = data.payload;
            ws.data.nickname = nickname;
            
            // Validação estrita de admin
            ws.data.isHost = adminPassword === ADMIN_PASSWORD;

            const player: Player = {
              id: ws.data.playerId,
              nickname,
              score: 0,
              isHost: ws.data.isHost,
              connected: true,
            };
            globalRoom.players.push(player);
            broadcastState();
            break;
            
          case GameEventType.START_GAME:
            if (ws.data.isHost && globalRoom.players.length >= MIN_PLAYERS) {
              globalRoom.state = GameState.PROMPT_PHASE;
              globalRoom.currentRound = 1;
              const creator = globalRoom.players[Math.floor(Math.random() * globalRoom.players.length)];
              globalRoom.promptCreatorId = creator.id;
              responses = [];
              globalRoom.responses = [];
              broadcastState();
            }
            break;

          case GameEventType.SUBMIT_PROMPT:
            if (globalRoom.state === GameState.PROMPT_PHASE && ws.data.playerId === globalRoom.promptCreatorId) {
              globalRoom.currentPrompt = data.payload.prompt;
              globalRoom.state = GameState.RESPONSE_PHASE;
              broadcastState();
            }
            break;

          case GameEventType.SUBMIT_RESPONSE:
            if (globalRoom.state === GameState.RESPONSE_PHASE && ws.data.playerId !== globalRoom.promptCreatorId) {
              if (!responses.some(r => r.playerId === ws.data.playerId)) {
                responses.push({ playerId: ws.data.playerId, text: data.payload.response, votes: [] });
                const totalExpected = globalRoom.players.length - 1;
                if (responses.length >= totalExpected) {
                  // Prepara respostas anônimas para o frontend
                  globalRoom.responses = responses.map(r => ({ id: r.playerId, text: r.text }));
                  globalRoom.state = GameState.VOTING_PHASE;
                  playersWhoVoted.clear();
                }
                broadcastState();
              }
            }
            break;

          case GameEventType.SUBMIT_VOTE:
            if (globalRoom.state === GameState.VOTING_PHASE) {
              const targetPlayerId = data.payload.responseId;
              // Não pode votar em si mesmo
              if (targetPlayerId === ws.data.playerId) return sendError(ws, "Não pode votar em si mesmo!");
              // Já votou?
              if (playersWhoVoted.has(ws.data.playerId)) return;

              const response = responses.find(r => r.playerId === targetPlayerId);
              if (response) {
                response.votes.push(ws.data.playerId);
                playersWhoVoted.add(ws.data.playerId);
                
                // Se todos votaram (incluindo o mestre)
                if (playersWhoVoted.size >= globalRoom.players.length) {
                  // Contabiliza pontos e vai para resultados
                  responses.forEach(r => {
                    const p = globalRoom.players.find(player => player.id === r.playerId);
                    if (p) p.score += r.votes.length * 10;
                  });
                  globalRoom.state = GameState.RESULTS_PHASE;
                }
                broadcastState();
              }
            }
            break;

          case GameEventType.KICK_PLAYER:
            if (ws.data.isHost) {
              const targetId = data.payload.playerId;
              const targetWs = connectedSockets.get(targetId);
              if (targetWs) targetWs.close();
            }
            break;

          case GameEventType.RESET_GAME:
            if (ws.data.isHost) {
              globalRoom.state = GameState.LOBBY;
              globalRoom.currentRound = 0;
              responses = [];
              broadcastState();
            }
            break;
        }
      } catch (err) {
        console.error("❌ Erro:", err);
      }
    },
    close(ws: GameSocket) {
      connectedSockets.delete(ws.data.playerId);
      globalRoom.players = globalRoom.players.filter(p => p.id !== ws.data.playerId);
      broadcastState();
    },
  },
});

console.log(`🚀 Servidor rodando. Admin Password: ${ADMIN_PASSWORD}`);
