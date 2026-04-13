import { GameEventType, type RoomState, type Player, GameState, type AnonymousResponse, type RoundResult } from "@ese/shared";

const screens = {
  welcome: document.getElementById('welcome-screen')!,
  howToPlay: document.getElementById('how-to-play-screen')!,
  login: document.getElementById('login-screen')!,
  lobby: document.getElementById('lobby-screen')!,
  prompt: document.getElementById('prompt-screen')!,
  response: document.getElementById('response-screen')!,
  voting: document.getElementById('voting-screen')!,
  results: document.getElementById('results-screen')!,
  waiting: document.getElementById('waiting-screen')!,
};

// UI Elements
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const adminModeBtn = document.getElementById('admin-mode-btn') as HTMLButtonElement;
const adminField = document.getElementById('admin-field') as HTMLDivElement;
const adminPasswordInput = document.getElementById('admin-password') as HTMLInputElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const nextRoundBtn = document.getElementById('next-round-btn') as HTMLButtonElement;
const submitPromptBtn = document.getElementById('submit-prompt-btn') as HTMLButtonElement;
const submitResponseBtn = document.getElementById('submit-response-btn') as HTMLButtonElement;

const nicknameInput = document.getElementById('nickname') as HTMLInputElement;
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const responseInput = document.getElementById('response-input') as HTMLTextAreaElement;

const playerListDiv = document.getElementById('player-list') as HTMLDivElement;
const votingListDiv = document.getElementById('voting-list') as HTMLDivElement;
const resultsListDiv = document.getElementById('results-list') as HTMLDivElement;
const displayPromptDiv = document.getElementById('display-prompt') as HTMLDivElement;
const hostControls = document.getElementById('host-controls') as HTMLDivElement;
const resultsControls = document.getElementById('results-controls') as HTMLDivElement;
const toastContainer = document.getElementById('toast-container') as HTMLDivElement;

// Report Elements
const reportBtnWrapper = document.getElementById('report-btn-wrapper') as HTMLDivElement;
const reportBtn = document.querySelector('.report-btn') as HTMLDivElement;
const reportModal = document.getElementById('report-modal') as HTMLDivElement;
const playerReportList = document.getElementById('player-report-list') as HTMLDivElement;
const closeModalBtn = document.getElementById('close-modal-btn') as HTMLButtonElement;

// Navigation Buttons
const goToLoginBtn = document.getElementById('go-to-login-btn') as HTMLButtonElement;
const goToHowBtn = document.getElementById('go-to-how-btn') as HTMLButtonElement;
const backToWelcomeBtn = document.getElementById('back-to-welcome-btn') as HTMLButtonElement;
const backFromLoginBtn = document.getElementById('back-from-login-btn') as HTMLButtonElement;

let socket: WebSocket | null = null;
let myNickname = "";
let myPlayerId = "";
let isAdminMode = false;
let lastRoomState: RoomState | null = null;

// --- SOUND MANAGER ---
const AudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
function playSound(type: 'click' | 'success' | 'phase' | 'warning') {
  if (AudioCtx.state === 'suspended') AudioCtx.resume();
  const osc = AudioCtx.createOscillator();
  const gain = AudioCtx.createGain();
  osc.connect(gain); gain.connect(AudioCtx.destination);
  const now = AudioCtx.currentTime;
  switch(type) {
    case 'click':
      osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now); osc.stop(now + 0.1); break;
    case 'success':
      [440, 554, 659].forEach((f, i) => { osc.frequency.setValueAtTime(f, now + i * 0.1); });
      gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now); osc.stop(now + 0.4); break;
    case 'phase':
      osc.frequency.setValueAtTime(200, now); osc.frequency.linearRampToValueAtTime(400, now + 0.2);
      gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.2);
      osc.start(now); osc.stop(now + 0.2); break;
    case 'warning':
      osc.frequency.setValueAtTime(150, now); gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3); osc.start(now); osc.stop(now + 0.3); break;
  }
}

// --- UI UTILS ---
function showToast(message: string, type: 'error' | 'success' | 'warning' = 'error') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  toastContainer.appendChild(toast);
  if (type === 'error' || type === 'warning') playSound('warning');
  else playSound('click');
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(50px)'; setTimeout(() => toast.remove(), 400); }, 4000);
}

function showScreen(screen: HTMLElement) {
  Object.values(screens).forEach(s => s.style.display = 'none');
  screen.style.display = 'flex';
  const noReportScreens = [screens.welcome, screens.howToPlay, screens.login];
  reportBtnWrapper.style.display = noReportScreens.includes(screen) ? 'none' : 'block';
}

function updateUI(room: RoomState) {
  const me = room.players.find(p => p.id === myPlayerId);
  const isMeHost = me?.isHost || false;

  if (lastRoomState?.state !== room.state) {
    playSound('phase');
    if (room.state === GameState.PROMPT_PHASE) showToast("A partida começou!", "success");
    if (room.state === GameState.VOTING_PHASE) showToast("Hora de votar!", "warning");
    if (room.state === GameState.RESULTS_PHASE) { showToast("Rodada finalizada!", "success"); playSound('success'); }
  }
  
  lastRoomState = room;

  switch (room.state) {
    case GameState.LOBBY:
      showScreen(screens.lobby);
      playerListDiv.innerHTML = '';
      room.players.forEach(p => {
        const tag = document.createElement('div');
        tag.className = `player-tag ${p.id === myPlayerId ? 'me' : ''}`;
        tag.innerHTML = `${p.isHost ? '👑 ' : ''}${p.nickname} <span style="margin-left:0.5rem; opacity:0.4; font-size:0.8rem;">${p.score}</span>`;
        playerListDiv.appendChild(tag);
      });
      hostControls.style.display = isMeHost ? 'block' : 'none';
      startBtn.disabled = room.players.length < 2;
      break;

    case GameState.PROMPT_PHASE:
      if (room.promptCreatorId === myPlayerId) {
        showScreen(screens.prompt);
      } else {
        showScreen(screens.waiting);
        const creator = room.players.find(p => p.id === room.promptCreatorId);
        document.getElementById('waiting-message')!.innerText = `${creator?.nickname || 'Mestre'} está criando a ocasião...`;
      }
      break;

    case GameState.RESPONSE_PHASE:
      displayPromptDiv.innerText = room.currentPrompt || "";
      if (room.promptCreatorId === myPlayerId) {
        showScreen(screens.waiting);
        document.getElementById('waiting-message')!.innerText = `Aguardando as respostas...`;
      } else {
        showScreen(screens.response);
      }
      break;

    case GameState.VOTING_PHASE:
      showScreen(screens.voting);
      votingListDiv.innerHTML = '';
      const canVote = room.responses?.some(res => res.id !== myPlayerId);
      if (!canVote) {
        showScreen(screens.waiting);
        document.getElementById('waiting-message')!.innerText = `Aguardando votos dos outros...`;
      } else {
        room.responses?.forEach((res: AnonymousResponse) => {
          if (res.id === myPlayerId) return;
          const card = document.createElement('div');
          card.className = 'vote-card';
          card.innerText = res.text;
          card.onclick = () => {
            playSound('click');
            socket?.send(JSON.stringify({ type: GameEventType.SUBMIT_VOTE, payload: { responseId: res.id } }));
            showScreen(screens.waiting);
            document.getElementById('waiting-message')!.innerText = `Voto enviado!`;
          };
          votingListDiv.appendChild(card);
        });
      }
      break;

    case GameState.RESULTS_PHASE:
      showScreen(screens.results);
      resultsListDiv.innerHTML = '';
      room.roundResults?.sort((a, b) => b.voteCount - a.voteCount).forEach((res: RoundResult) => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
          <div style="text-align: left;">
            <div style="font-size:0.7rem; opacity:0.5; text-transform:uppercase; font-weight:800;">${res.authorNickname}</div>
            <div style="font-size:1.1rem; font-weight:800;">${res.text}</div>
          </div>
          <div class="score-badge">+${res.voteCount * 10}</div>
        `;
        resultsListDiv.appendChild(card);
      });
      resultsControls.style.display = isMeHost ? 'block' : 'none';
      break;

    case GameState.GAME_OVER:
      showScreen(screens.waiting);
      document.getElementById('waiting-message')!.innerText = `Fim de Jogo!`;
      break;
  }
}

// --- NAVIGATION ---
goToLoginBtn.onclick = () => { playSound('click'); showScreen(screens.login); };
goToHowBtn.onclick = () => { playSound('click'); showScreen(screens.howToPlay); };
backToWelcomeBtn.onclick = () => { playSound('click'); showScreen(screens.welcome); };
backFromLoginBtn.onclick = () => { playSound('click'); showScreen(screens.welcome); };

// --- ACTIONS ---
reportBtn.onclick = () => {
  playSound('click');
  if (!lastRoomState) return;
  playerReportList.innerHTML = '';
  lastRoomState.players.forEach(p => {
    if (p.id === myPlayerId || p.isHost) return;
    const item = document.createElement('div');
    item.className = 'report-item';
    item.innerText = p.nickname;
    item.onclick = () => {
      playSound('warning');
      socket?.send(JSON.stringify({ type: GameEventType.REPORT_PLAYER, payload: { playerId: p.id } }));
      reportModal.style.display = 'none';
    };
    playerReportList.appendChild(item);
  });
  reportModal.style.display = 'flex';
};

closeModalBtn.onclick = () => { playSound('click'); reportModal.style.display = 'none'; };

adminModeBtn.onclick = () => {
  playSound('click');
  isAdminMode = !isAdminMode;
  adminField.style.display = isAdminMode ? 'block' : 'none';
  adminModeBtn.innerText = isAdminMode ? "Modo Jogador" : "Modo Admin";
};

connectBtn.onclick = () => {
  playSound('click');
  myNickname = nicknameInput.value.trim();
  if (!myNickname) return showToast("Escolha um apelido!");
  const serverUrl = (document.getElementById('server-url') as HTMLInputElement).value;
  socket = new WebSocket(serverUrl);
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "INITIAL_ID") {
      myPlayerId = data.payload.playerId;
      socket?.send(JSON.stringify({ type: GameEventType.JOIN_ROOM, payload: { nickname: myNickname, adminPassword: isAdminMode ? adminPasswordInput.value : "" } }));
      return;
    }
    if (data.type === GameEventType.ROOM_STATE_UPDATE) updateUI(data.payload);
    if (data.type === GameEventType.TOAST) showToast(data.payload.message, data.payload.type);
  };
  socket.onclose = () => { showScreen(screens.welcome); showToast("Conexão perdida.", "error"); };
};

startBtn.onclick = () => socket?.send(JSON.stringify({ type: GameEventType.START_GAME, payload: {} }));
resetBtn.onclick = () => socket?.send(JSON.stringify({ type: GameEventType.RESET_GAME, payload: {} }));
nextRoundBtn.onclick = () => socket?.send(JSON.stringify({ type: GameEventType.NEXT_ROUND, payload: {} }));
submitPromptBtn.onclick = () => {
  const prompt = promptInput.value.trim();
  if (!prompt) return showToast("Escreva algo!");
  socket?.send(JSON.stringify({ type: GameEventType.SUBMIT_PROMPT, payload: { prompt } }));
};
submitResponseBtn.onclick = () => {
  const response = responseInput.value.trim();
  if (!response) return showToast("Escreva algo!");
  socket?.send(JSON.stringify({ type: GameEventType.SUBMIT_RESPONSE, payload: { response } }));
  showScreen(screens.waiting);
  document.getElementById('waiting-message')!.innerText = `Resposta enviada!`;
};
