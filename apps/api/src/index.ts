import { GameEventType, type SocketMessage } from "@ese/shared";

const server = Bun.serve<{ nickname?: string }>({
  port: process.env.PORT || 3000,
  fetch(req, server) {
    const success = server.upgrade(req);
    if (success) return undefined;
    
    return new Response("Servidor 'E se...' em execução!");
  },
  websocket: {
    open(ws) {
      console.log("🟢 Cliente conectado!");
    },
    message(ws, message) {
      try {
        const data = JSON.parse(message.toString()) as SocketMessage;
        console.log(`📩 Recebido: ${data.type}`);

        // Exemplo simples de resposta
        if (data.type === GameEventType.JOIN_ROOM) {
           ws.send(JSON.stringify({
             type: GameEventType.ROOM_STATE_UPDATE,
             payload: { message: "Bem-vindo ao jogo 'E se...'!" }
           }));
        }
      } catch (err) {
        console.error("❌ Erro ao processar mensagem:", err);
      }
    },
    close(ws) {
      console.log("🔴 Cliente desconectado");
    },
  },
});

console.log(`🚀 Servidor rodando em: ${server.hostname}:${server.port}`);
