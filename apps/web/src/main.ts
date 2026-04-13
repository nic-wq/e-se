import { GameEventType, type RoomState, type Player, GameState, type AnonymousResponse } from "@ese/shared";

// Elementos da UI
const loginScreen = document.getElementById('login-screen') as HTMLDivElement;
const lobbyScreen = document.getElementById('lobby-screen') as HTMLDivElement;
const promptScreen = document.getElementById('prompt-screen') as HTMLDivElement;
const responseScreen = document.getElementById('response-screen') as HTMLDivElement;
const votingScreen = document.getElementById('voting-screen') as HTMLDivElement;
const waitingScreen = document.getElementById('waiting-screen') as HTMLDivElement;

const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const adminModeBtn = document.getElementById('admin-mode-btn') as HTMLButtonElement;
const adminField = document.getElementById('admin-field') as HTMLDivElement;
const adminPasswordInput = document.getElementById('admin-password') as HTMLInputElement;

const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const submitPromptBtn = document.getElementById('submit-prompt-btn') as HTMLButtonElement;
const submitResponseBtn = document.getElementById('submit-response-btn') as HTMLButtonElement;

const serverInput = document.getElementById('server-url') as HTMLInputElement;
const nicknameInput = document.getElementById('nickname') as HTMLInputElement;
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const responseInput = document.getElementById('response-input') as HTMLTextAreaElement;

const statusDiv = document.getElementById('status') as HTMLDivElement;
const playerListDiv = document.getElementById('player-list') as HTMLDivElement;
const votingListDiv = document.getElementById('voting-list') as HTMLDivElement;
const displayPromptDiv = document.getElementById('display-prompt') as HTMLDivElement;
const hostControls = document.getElementById('host-controls') as HTMLDivElement;
const gameTitle = document.getElementById('game-title') as HTMLHeadingElement;

let socket: WebSocket | null = null;
let myNickname = "";
let myPlayerId = "";
let isAdminMode = false;

function showScreen(screen: HTMLElement) {
  [loginScreen, lobbyScreen, promptScreen, responseScreen, votingScreen, waitingScreen].forEach(s => s.style.display = 'none');
  screen.style.display = 'flex';
}

function updateUI(room: RoomState) {
  const me = room.players.find(p => p.id === myPlayerId);
  const isMeHost = me?.isHost || false;

  gameTitle.style.fontSize = room.state === GameState.LOBBY ? '5rem' : '2.5rem';

  switch (room.state) {
    case GameState.LOBBY:
      showScreen(lobbyScreen);
      playerListDiv.innerHTML = '';
      room.players.forEach(p => {
        const tag = document.createElement('div');
        tag.className = `player-tag ${p.id === myPlayerId ? 'me' : ''}`;
        tag.innerHTML = `${p.isHost ? '👑 ' : ''}${p.nickname}`;
        
        // Botão de Kick para o Host
        if (isMeHost && p.id !== myPlayerId) {
          const kick = document.createElement('button');
          kick.innerText = 'KICK';
          kick.className = 'kick-btn';
          kick.onclick = (e) => {
            e.stopPropagation();
            socket?.send(JSON.stringify({ type: GameEventType.KICK_PLAYER, payload: { playerId: p.id } }));
          };
          tag.appendChild(kick);
        }
        playerListDiv.appendChild(tag);
      });
      hostControls.style.display = (isMeHost && room.players.length >= 2) ? 'block' : 'none';
      break;

    case GameState.PROMPT_PHASE:
      if (room.promptCreatorId === myPlayerId) {
        showScreen(promptScreen);
        promptInput.value = "";
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
        responseInput.value = "";
      }
      break;

    case GameState.VOTING_PHASE:
      showScreen(votingScreen);
      votingListDiv.innerHTML = '';
      room.responses?.forEach((res: AnonymousResponse) => {
        // Não pode votar em si mesmo
        if (res.id === myPlayerId) return;

        const card = document.createElement('div');
        card.className = 'vote-card';
        card.innerText = res.text;
        card.onclick = () => {
          socket?.send(JSON.stringify({ type: GameEventType.SUBMIT_VOTE, payload: { responseId: res.id } }));
          showScreen(waitingScreen);
          document.getElementById('waiting-message')!.innerText = `Voto computado! Aguardando os outros...`;
        };
        votingListDiv.appendChild(card);
      });
      break;

    case GameState.RESULTS_PHASE:
      showScreen(waitingScreen);
      document.getElementById('waiting-message')!.innerText = `Resultados! (Em breve...)`;
      break;
  }
}

adminModeBtn.addEventListener('click', () => {
  isAdminMode = !isAdminMode;
  adminField.style.display = isAdminMode ? 'block' : 'none';
  connectBtn.innerText = isAdminMode ? 'Entrar como Admin' : 'Entrar como Jogador';
  adminModeBtn.innerText = isAdminMode ? 'Voltar para Jogador' : 'Entrar como Admin';
});

connectBtn.addEventListener('click', () => {
  myNickname = nicknameInput.value.trim();
  if (!myNickname) return alert('Nickname!');

  socket = new WebSocket(serverInput.value);
  
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === "INITIAL_ID") {
      myPlayerId = data.payload.playerId;
      socket?.send(JSON.stringify({ 
        type: GameEventType.JOIN_ROOM, 
        payload: { 
          nickname: myNickname,
          adminPassword: isAdminMode ? adminPasswordInput.value : ""
        } 
      }));
      return;
    }

    if (data.type === GameEventType.ROOM_STATE_UPDATE) {
      statusDiv.innerText = "";
      updateUI(data.payload);
    }

    if (data.type === GameEventType.ERROR) {
      statusDiv.innerText = data.payload.message;
    }
  };

  socket.onclose = () => {
    showScreen(loginScreen);
    statusDiv.innerText = "Conexão encerrada.";
  };
});

startBtn.addEventListener('click', () => {
  socket?.send(JSON.stringify({ type: GameEventType.START_GAME, payload: {} }));
});

resetBtn.addEventListener('click', () => {
  socket?.send(JSON.stringify({ type: GameEventType.RESET_GAME, payload: {} }));
});

submitPromptBtn.addEventListener('click', () => {
  const prompt = promptInput.value.trim();
  if (prompt) socket?.send(JSON.stringify({ type: GameEventType.SUBMIT_PROMPT, payload: { prompt } }));
});

submitResponseBtn.addEventListener('click', () => {
  const response = responseInput.value.trim();
  if (response) socket?.send(JSON.stringify({ type: GameEventType.SUBMIT_RESPONSE, payload: { response } }));
});
