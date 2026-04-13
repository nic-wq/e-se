import { GameEventType } from "@ese/shared";

const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const serverInput = document.getElementById('server-url') as HTMLInputElement;
const nicknameInput = document.getElementById('nickname') as HTMLInputElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

let socket: WebSocket | null = null;

connectBtn.addEventListener('click', () => {
  const url = serverInput.value;
  const nickname = nicknameInput.value;

  if (!nickname) {
    alert('Por favor, escolha um nickname!');
    return;
  }

  statusDiv.innerText = 'Conectando...';
  
  try {
    socket = new WebSocket(url);

    socket.onopen = () => {
      statusDiv.innerText = '✅ Conectado ao servidor!';
      statusDiv.style.color = '#4caf50';
      
      // Envia evento de entrar na sala
      socket?.send(JSON.stringify({
        type: GameEventType.JOIN_ROOM,
        payload: { nickname }
      }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📩 Mensagem do servidor:', data);
      
      if (data.type === GameEventType.ROOM_STATE_UPDATE) {
        statusDiv.innerText = `Servidor diz: ${data.payload.message}`;
      }
    };

    socket.onerror = () => {
      statusDiv.innerText = '❌ Erro de conexão!';
      statusDiv.style.color = '#f44336';
    };

    socket.onclose = () => {
      statusDiv.innerText = '🔴 Conexão encerrada.';
      statusDiv.style.color = '#aaa';
    };

  } catch (err) {
    statusDiv.innerText = '❌ URL de servidor inválida!';
  }
});
