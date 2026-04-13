import { GameEventType, GameState, type Player, type RoomState, type SocketMessage, type AnonymousResponse, type RoundResult } from "@ese/shared";
import { randomUUID } from "crypto";
import type { ServerWebSocket } from "bun";
import * as readline from "node:readline";

type GameSocket = ServerWebSocket<{ nickname: string, playerId: string, isHost: boolean }>;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS || "10");
const MAX_ROUNDS = parseInt(process.env.MAX_ROUNDS || "5");
const MIN_PLAYERS = parseInt(process.env.MIN_PLAYERS || "2");

let responses: RoundResponse[] = [];
let playersWhoVoted: Set<string> = new Set();
const reports: Map<string, Set<string>> = new Map();

interface RoundResponse {
  playerId: string;
  nickname: string;
  text: string;
  votes: string[];
}

const globalRoom: RoomState = {
  code: "GLOBAL",
  state: GameState.LOBBY,
  players: [],
  currentRound: 0,
  maxRounds: MAX_ROUNDS,
  responses: [],
  roundResults: [],
};

const connectedSockets: Map<string, GameSocket> = new Map();

const broadcastState = () => {
  const message = JSON.stringify({
    type: GameEventType.ROOM_STATE_UPDATE,
    payload: globalRoom,
  });
  console.log(`📢 [${new Date().toLocaleTimeString()}] Broadcast Estado: ${globalRoom.state}`);
  for (const socket of connectedSockets.values()) {
    socket.send(message);
  }
};

const sendToast = (ws: GameSocket, message: string, type: 'error' | 'success' | 'warning' = 'error') => {
  ws.send(JSON.stringify({ type: GameEventType.TOAST, payload: { message, type } }));
};

const removePlayerFromGame = (playerId: string) => {
  const player = globalRoom.players.find(p => p.id === playerId);
  if (!player) return;

  console.log(`👋 Removendo jogador: ${player.nickname}`);
  globalRoom.players = globalRoom.players.filter(p => p.id !== playerId);
  connectedSockets.delete(playerId);
  reports.delete(playerId); // Limpa as denúncias que ele recebeu

  // Se o Host saiu, promove outro (prioriza Admins se houver)
  if (player.isHost && globalRoom.players.length > 0) {
    globalRoom.players[0].isHost = true;
  }

  // Se o MESTRE saiu durante a rodada, reseta a rodada ou volta pro Lobby
  if (globalRoom.promptCreatorId === playerId && 
     (globalRoom.state === GameState.PROMPT_PHASE || globalRoom.state === GameState.RESPONSE_PHASE)) {
    console.log(`⚠️ Mestre desconectou. Resetando para o Lobby.`);
    globalRoom.state = GameState.LOBBY;
    globalRoom.currentRound = 0;
    responses = [];
  }

  broadcastState();
};

// --- CONSOLE INTERATIVO ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
rl.on("line", (line) => {
  const [cmd, ...args] = line.trim().split(" ");
  switch (cmd.toLowerCase()) {
    case "kick":
      const name = args.join(" ");
      const p = globalRoom.players.find(pl => pl.nickname === name || pl.id === name);
      if (p) {
        console.log(`🚫 Kickando via console: ${p.nickname}`);
        const ws = connectedSockets.get(p.id);
        if (ws) ws.close(); // Isso aciona o evento 'close' e removePlayerFromGame
      }
      break;
    case "status":
      console.table(globalRoom.players.map(p => ({ Nick: p.nickname, Reports: reports.get(p.id)?.size || 0 })));
      break;
    case "reset":
      globalRoom.state = GameState.LOBBY;
      broadcastState();
      break;
  }
});

const server = Bun.serve<{ nickname: string, playerId: string, isHost: boolean }>({
  port: process.env.PORT || 3000,
  fetch(req, server) {
    const success = server.upgrade(req, {
      data: { nickname: "", playerId: randomUUID(), isHost: false }
    });
    if (success) return undefined;
    return new Response("E se... backend.");
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
            if (globalRoom.players.length >= MAX_PLAYERS) return sendToast(ws, "Sala cheia!");
            const { nickname, adminPassword } = data.payload;
            ws.data.nickname = nickname;
            ws.data.isHost = adminPassword === ADMIN_PASSWORD;
            globalRoom.players.push({ id: ws.data.playerId, nickname, score: 0, isHost: ws.data.isHost, connected: true });
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
                responses.push({ playerId: ws.data.playerId, nickname: ws.data.nickname, text: data.payload.response, votes: [] });
                if (responses.length >= globalRoom.players.length - 1) {
                  globalRoom.responses = responses.map(r => ({ id: r.playerId, text: r.text }));
                  globalRoom.state = GameState.VOTING_PHASE;
                  playersWhoVoted.clear();
                }
                broadcastState();
              }
            }
            break;

          case GameEventType.SUBMIT_VOTE:
            if (globalRoom.state === GameState.VOTING_PHASE && !playersWhoVoted.has(ws.data.playerId)) {
              const res = responses.find(r => r.playerId === data.payload.responseId);
              if (res && res.playerId !== ws.data.playerId) {
                res.votes.push(ws.data.playerId);
                playersWhoVoted.add(ws.data.playerId);
                const validVoters = globalRoom.players.filter(p => responses.some(r => r.playerId !== p.id)).length;
                if (playersWhoVoted.size >= validVoters) {
                  globalRoom.roundResults = responses.map(r => {
                    const p = globalRoom.players.find(player => player.id === r.playerId);
                    if (p) p.score += r.votes.length * 10;
                    return { authorNickname: r.nickname, text: r.text, voteCount: r.votes.length };
                  });
                  globalRoom.state = GameState.RESULTS_PHASE;
                }
                broadcastState();
              }
            }
            break;

          case GameEventType.REPORT_PLAYER:
            const targetId = data.payload.playerId;
            const target = globalRoom.players.find(p => p.id === targetId);
            if (!target || targetId === ws.data.playerId || target.isHost) return;
            
            if (!reports.has(targetId)) reports.set(targetId, new Set());
            const reporters = reports.get(targetId)!;
            
            if (!reporters.has(ws.data.playerId)) {
              reporters.add(ws.data.playerId);
              sendToast(ws, `Denúncia contra ${target.nickname} enviada.`, 'success');
              
              if (reporters.size >= 3) {
                console.log(`🚫 Expulsão automática (Reports): ${target.nickname}`);
                connectedSockets.get(targetId)?.close();
              } else {
                const targetWs = connectedSockets.get(targetId);
                if (targetWs) sendToast(targetWs, `Atenção: Denúncia por Anti-Jogo recebida (${reporters.size}/3).`, 'warning');
              }
            } else {
              sendToast(ws, "Você já denunciou este jogador nesta partida.");
            }
            break;

          case GameEventType.NEXT_ROUND:
            if (ws.data.isHost) {
              if (globalRoom.currentRound < globalRoom.maxRounds) {
                globalRoom.currentRound++;
                globalRoom.state = GameState.PROMPT_PHASE;
                const creator = globalRoom.players[Math.floor(Math.random() * globalRoom.players.length)];
                globalRoom.promptCreatorId = creator.id;
                responses = [];
                globalRoom.responses = [];
                globalRoom.roundResults = [];
                broadcastState();
              } else {
                globalRoom.state = GameState.GAME_OVER;
                broadcastState();
              }
            }
            break;

          case GameEventType.RESET_GAME:
            if (ws.data.isHost) {
              globalRoom.state = GameState.LOBBY;
              globalRoom.currentRound = 0;
              responses = [];
              globalRoom.players.forEach(p => p.score = 0);
              broadcastState();
            }
            break;
        }
      } catch (err) {
        console.error("Erro no processamento:", err);
      }
    },
    close(ws: GameSocket) {
      removePlayerFromGame(ws.data.playerId);
    },
  },
});

console.log(`🚀 "E se..." rodando! Senha: ${ADMIN_PASSWORD}`);
