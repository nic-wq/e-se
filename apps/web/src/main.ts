import { GameEventType, type RoomState, type Player } from "@ese/shared";

// Elementos da UI
const loginScreen = document.getElementById('login-screen') as HTMLDivElement;
const lobbyScreen = document.getElementById('lobby-screen') as HTMLDivElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const serverInput = document.getElementById('server-url') as HTMLInputElement;
const nicknameInput = document.getElementById('nickname') as HTMLInputElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const playerListDiv = document.getElementById('player-list') as HTMLDivElement;
const roomInfo = document.getElementById('room-info') as HTMLDivElement;
const hostControls = document.getElementById('host-controls') as HTMLDivElement;

let socket: WebSocket | null = null;
let myNickname = "";

function updateLobby(room: RoomState) {
  playerListDiv.innerHTML = '';
  
  room.players.forEach((player: Player) => {
    const tag = document.createElement('div');
    tag.className = 'player-tag';
    tag.innerText = `${player.isHost ? '👑 ' : ''}${player.nickname}`;
    if (player.nickname === myNickname) {
      tag.style.borderColor = 'var(--primary)';
      tag.style.borderWidth = '1px';
      tag.style.borderStyle = 'solid';
    }
    playerListDiv.appendChild(tag);
  });

  const me = room.players.find(p => p.nickname === myNickname);
  
  if (room.state === 'LOBBY') {
    loginScreen.style.display = 'none';
    lobbyScreen.style.display = 'block';
    
    roomInfo.innerText = `Lobby (${room.players.length} jogadores)`;
    
    // Mostra controles de host se for o host e tiver 2+ jogadores
    if (me?.isHost && room.players.length >= 2) {
      hostControls.style.display = 'block';
    } else {
      hostControls.style.display = 'none';
      if (me?.isHost) {
        roomInfo.innerText = "Aguardando mais jogadores para começar...";
      }
    }
  } else {
    // Se o jogo começou, limpa o lobby por enquanto
    lobbyScreen.style.display = 'none';
    statusDiv.innerText = `🚀 O jogo começou! (Fase: ${room.state})`;
  }
}

connectBtn.addEventListener('click', () => {
  const url = serverInput.value;
  myNickname = nicknameInput.value.trim();

  if (!myNickname) {
    alert('Escolha um nickname legal!');
    return;
  }

  statusDiv.innerText = 'Conectando ao servidor...';
  
  try {
    socket = new WebSocket(url);

    socket.onopen = () => {
      socket?.send(JSON.stringify({
        type: GameEventType.JOIN_ROOM,
        payload: { nickname: myNickname }
      }));
      statusDiv.innerText = '';
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === GameEventType.ROOM_STATE_UPDATE) {
        updateLobby(data.payload);
      }
    };

    socket.onerror = () => {
      statusDiv.innerText = '❌ Não foi possível conectar ao servidor.';
    };

    socket.onclose = () => {
      loginScreen.style.display = 'block';
      lobbyScreen.style.display = 'none';
      statusDiv.innerText = '🔴 Conexão perdida.';
    };

  } catch (err) {
    statusDiv.innerText = '❌ Endereço de servidor inválido!';
  }
});

startBtn.addEventListener('click', () => {
  socket?.send(JSON.stringify({
    type: GameEventType.START_GAME,
    payload: {}
  }));
});
