import { GameEventType, GameState, type Player, type RoomState, type SocketMessage } from "@ese/shared";
import { randomUUID } from "crypto";
import type { ServerWebSocket } from "bun";

type GameSocket = ServerWebSocket<{ nickname: string, playerId: string }>;

// Estado global da sala única desta instância
const globalRoom: RoomState = {
  code: "GLOBAL",
  state: GameState.LOBBY,
  players: [],
  currentRound: 0,
  maxRounds: 5,
};

// Sockets conectados nesta sala
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

const server = Bun.serve<{ nickname: string, playerId: string }>({
  port: process.env.PORT || 3000,
  fetch(req, server) {
    const success = server.upgrade(req, {
      data: {
        nickname: "",
        playerId: randomUUID(),
      }
    });
    if (success) return undefined;
    
    return new Response("Servidor 'E se...' em execução!");
  },
  websocket: {
    open(ws: GameSocket) {
      connectedSockets.add(ws);
      console.log(`🟢 Conexão aberta (${ws.data.playerId})`);
    },
    message(ws: GameSocket, message) {
      try {
        const data = JSON.parse(message.toString()) as SocketMessage;
        
        switch (data.type) {
          case GameEventType.JOIN_ROOM:
            const { nickname } = data.payload;
            ws.data.nickname = nickname;

            // Se for o primeiro, é host
            const isHost = globalRoom.players.length === 0;
            const player: Player = {
              id: ws.data.playerId,
              nickname,
              score: 0,
              isHost,
              connected: true,
            };

            globalRoom.players.push(player);
            console.log(`👤 ${nickname} entrou no jogo (Host: ${isHost})`);
            broadcastState();
            break;
            
          case GameEventType.START_GAME:
            // Apenas host inicia se houver 2+ jogadores
            const me = globalRoom.players.find(p => p.id === ws.data.playerId);
            if (me?.isHost && globalRoom.players.length >= 2) {
              globalRoom.state = GameState.PROMPT_PHASE;
              globalRoom.currentRound = 1;
              const creator = globalRoom.players[Math.floor(Math.random() * globalRoom.players.length)];
              globalRoom.promptCreatorId = creator.id;
              
              console.log(`🎮 Jogo iniciado! Criador: ${creator.nickname}`);
              broadcastState();
            }
            break;

          default:
            console.log(`📩 Evento não tratado: ${data.type}`);
        }
      } catch (err) {
        console.error("❌ Erro ao processar mensagem:", err);
      }
    },
    close(ws: GameSocket) {
      connectedSockets.delete(ws);
      globalRoom.players = globalRoom.players.filter(p => p.id !== ws.data.playerId);
      
      if (globalRoom.players.length > 0 && !globalRoom.players.some(p => p.isHost)) {
        globalRoom.players[0].isHost = true;
      }
      
      console.log(`🏃 ${ws.data.nickname || 'Anônimo'} saiu`);
      broadcastState();
    },
  },
});

console.log(`🚀 Servidor rodando em: ${server.hostname}:${server.port}`);
