import { GameEventType, type RoomState, type Player, GameState } from "@ese/shared";

// Elementos da UI
const loginScreen = document.getElementById('login-screen') as HTMLDivElement;
const lobbyScreen = document.getElementById('lobby-screen') as HTMLDivElement;
const promptScreen = document.getElementById('prompt-screen') as HTMLDivElement;
const responseScreen = document.getElementById('response-screen') as HTMLDivElement;
const waitingScreen = document.getElementById('waiting-screen') as HTMLDivElement;

const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const adminModeBtn = document.getElementById('admin-mode-btn') as HTMLButtonElement;
const adminField = document.getElementById('admin-field') as HTMLDivElement;
const adminPasswordInput = document.getElementById('admin-password') as HTMLInputElement;

const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const submitPromptBtn = document.getElementById('submit-prompt-btn') as HTMLButtonElement;
const submitResponseBtn = document.getElementById('submit-response-btn') as HTMLButtonElement;

const serverInput = document.getElementById('server-url') as HTMLInputElement;
const nicknameInput = document.getElementById('nickname') as HTMLInputElement;
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const responseInput = document.getElementById('response-input') as HTMLTextAreaElement;

const statusDiv = document.getElementById('status') as HTMLDivElement;
const playerListDiv = document.getElementById('player-list') as HTMLDivElement;
const displayPromptDiv = document.getElementById('display-prompt') as HTMLDivElement;
const hostControls = document.getElementById('host-controls') as HTMLDivElement;
const gameTitle = document.getElementById('game-title') as HTMLHeadingElement;

let socket: WebSocket | null = null;
let myNickname = "";
let myPlayerId = "";
let isAdminMode = false;

function showScreen(screen: HTMLElement) {
  [loginScreen, lobbyScreen, promptScreen, responseScreen, waitingScreen].forEach(s => s.style.display = 'none');
  screen.style.display = 'flex';
}

function updateUI(room: RoomState) {
  // Ajusta título
  gameTitle.style.fontSize = room.state === GameState.LOBBY ? '5rem' : '2.5rem';

  // Verifica meu estado na sala
  const me = room.players.find(p => p.id === myPlayerId);
  const isMeHost = me?.isHost || false;

  switch (room.state) {
    case GameState.LOBBY:
      showScreen(lobbyScreen);
      playerListDiv.innerHTML = '';
      room.players.forEach(p => {
        const tag = document.createElement('div');
        tag.className = `player-tag ${p.id === myPlayerId ? 'me' : ''}`;
        tag.innerText = `${p.isHost ? '👑 ' : ''}${p.nickname}`;
        playerListDiv.appendChild(tag);
      });
      hostControls.style.display = (isMeHost && room.players.length >= 2) ? 'block' : 'none';
      break;

    case GameState.PROMPT_PHASE:
      if (room.promptCreatorId === myPlayerId) {
        showScreen(promptScreen);
      } else {
        showScreen(waitingScreen);
        const creator = room.players.find(p => p.id === room.promptCreatorId);
        document.getElementById('waiting-message')!.innerText = `${creator?.nickname || 'Alguém'} está criando a ocasião...`;
      }
      break;

    case GameState.RESPONSE_PHASE:
      displayPromptDiv.innerText = room.currentPrompt || "";
      if (room.promptCreatorId === myPlayerId) {
        showScreen(waitingScreen);
        document.getElementById('waiting-message')!.innerText = `Aguardando as respostas...`;
      } else {
        showScreen(responseScreen);
      }
      break;

    case GameState.VOTING_PHASE:
      showScreen(waitingScreen);
      document.getElementById('waiting-message')!.innerText = `Fase de Votação (Em breve!)`;
      break;
  }
}

// Alternar modo admin
adminModeBtn.addEventListener('click', () => {
  isAdminMode = !isAdminMode;
  adminField.style.display = isAdminMode ? 'block' : 'none';
  connectBtn.innerText = isAdminMode ? 'Entrar como Admin' : 'Entrar como Jogador';
  adminModeBtn.innerText = isAdminMode ? 'Voltar para Jogador' : 'Entrar como Admin';
});

connectBtn.addEventListener('click', () => {
  myNickname = nicknameInput.value.trim();
  if (!myNickname) return alert('Escolha um nickname!');

  socket = new WebSocket(serverInput.value);
  
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    // Captura o ID único gerado pelo servidor logo no início
    if (data.type === "INITIAL_ID") {
      myPlayerId = data.payload.playerId;
      // Agora que temos o ID, enviamos o JOIN
      socket?.send(JSON.stringify({ 
        type: GameEventType.JOIN_ROOM, 
        payload: { 
          nickname: myNickname,
          adminPassword: isAdminMode ? adminPasswordInput.value : null
        } 
      }));
      return;
    }

    if (data.type === GameEventType.ROOM_STATE_UPDATE) {
      updateUI(data.payload);
    }
  };

  socket.onerror = () => {
    alert('Erro ao conectar ao servidor!');
  };
});

startBtn.addEventListener('click', () => {
  socket?.send(JSON.stringify({ type: GameEventType.START_GAME, payload: {} }));
});

submitPromptBtn.addEventListener('click', () => {
  const prompt = promptInput.value.trim();
  if (!prompt) return alert('Digite algo!');
  socket?.send(JSON.stringify({ type: GameEventType.SUBMIT_PROMPT, payload: { prompt } }));
});

submitResponseBtn.addEventListener('click', () => {
  const response = responseInput.value.trim();
  if (!response) return alert('Digite sua resposta!');
  socket?.send(JSON.stringify({ type: GameEventType.SUBMIT_RESPONSE, payload: { response } }));
  showScreen(waitingScreen);
  document.getElementById('waiting-message')!.innerText = `Resposta enviada! Aguardando os outros...`;
});
