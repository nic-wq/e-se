import { GameEventType, GameState, type Player, type RoomState, type SocketMessage } from "@ese/shared";
import { randomUUID } from "crypto";
import type { ServerWebSocket } from "bun";

type GameSocket = ServerWebSocket<{ nickname: string, playerId: string, isHost: boolean }>;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

interface RoundResponse {
  playerId: string;
  text: string;
  votes: string[];
}

let responses: RoundResponse[] = [];

const globalRoom: RoomState = {
  code: "GLOBAL",
  state: GameState.LOBBY,
  players: [],
  currentRound: 0,
  maxRounds: 5,
};

const connectedSockets: Set<GameSocket> = new Set();

const broadcastState = () => {
  const message = JSON.stringify({
    type: GameEventType.ROOM_STATE_UPDATE,
    payload: globalRoom,
  });
  for (const socket of connectedSockets) {
    socket.send(message);
  }
};

const server = Bun.serve<{ nickname: string, playerId: string, isHost: boolean }>({
  port: process.env.PORT || 3000,
  fetch(req, server) {
    const success = server.upgrade(req, {
      data: {
        nickname: "",
        playerId: randomUUID(),
        isHost: false,
      }
    });
    if (success) return undefined;
    return new Response("Servidor 'E se...' em execução!");
  },
  websocket: {
    open(ws: GameSocket) {
      connectedSockets.add(ws);
      // Enviamos o ID gerado para o cliente logo na conexão
      ws.send(JSON.stringify({
        type: "INITIAL_ID",
        payload: { playerId: ws.data.playerId }
      }));
    },
    message(ws: GameSocket, message) {
      try {
        const data = JSON.parse(message.toString()) as SocketMessage;
        
        switch (data.type) {
          case GameEventType.JOIN_ROOM:
            const { nickname, adminPassword } = data.payload;
            ws.data.nickname = nickname;
            
            // Define se é host baseado na senha ou se é o primeiro (se ninguém for host ainda)
            const hasHost = globalRoom.players.some(p => p.isHost);
            const isAdmin = adminPassword === ADMIN_PASSWORD;
            ws.data.isHost = isAdmin || (!hasHost && globalRoom.players.length === 0);

            const player: Player = {
              id: ws.data.playerId,
              nickname,
              score: 0,
              isHost: ws.data.isHost,
              connected: true,
            };
            
            globalRoom.players.push(player);
            console.log(`👤 ${nickname} entrou (Host: ${player.isHost})`);
            broadcastState();
            break;
            
          case GameEventType.START_GAME:
            if (ws.data.isHost && globalRoom.players.length >= 2) {
              globalRoom.state = GameState.PROMPT_PHASE;
              globalRoom.currentRound = 1;
              const creator = globalRoom.players[Math.floor(Math.random() * globalRoom.players.length)];
              globalRoom.promptCreatorId = creator.id;
              responses = [];
              broadcastState();
            }
            break;

          case GameEventType.SUBMIT_PROMPT:
            if (globalRoom.state === GameState.PROMPT_PHASE && ws.data.playerId === globalRoom.promptCreatorId) {
              globalRoom.currentPrompt = data.payload.prompt;
              globalRoom.state = GameState.RESPONSE_PHASE;
              responses = [];
              broadcastState();
            }
            break;

          case GameEventType.SUBMIT_RESPONSE:
            if (globalRoom.state === GameState.RESPONSE_PHASE) {
              if (!responses.some(r => r.playerId === ws.data.playerId)) {
                responses.push({ playerId: ws.data.playerId, text: data.payload.response, votes: [] });
                const totalExpected = globalRoom.players.length - 1;
                if (responses.length >= totalExpected) {
                  globalRoom.state = GameState.VOTING_PHASE;
                }
                broadcastState();
              }
            }
            break;
        }
      } catch (err) {
        console.error("❌ Erro:", err);
      }
    },
    close(ws: GameSocket) {
      connectedSockets.delete(ws);
      globalRoom.players = globalRoom.players.filter(p => p.id !== ws.data.playerId);
      // Se o host sair, o primeiro admin ou o primeiro da lista vira host
      if (ws.data.isHost && globalRoom.players.length > 0) {
        globalRoom.players[0].isHost = true;
        // Precisamos atualizar o ws.data.isHost do socket correspondente se quisermos ser rigorosos,
        // mas o broadcastState() já informa o frontend sobre o novo host.
      }
      broadcastState();
    },
  },
});

console.log(`🚀 Servidor rodando com senha de admin configurada.`);
