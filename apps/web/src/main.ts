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
  gameOver: document.getElementById('game-over-screen')!,
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
const backToLobbyBtn = document.getElementById('back-to-lobby-btn') as HTMLButtonElement;
const exitGameBtn = document.getElementById('exit-game-btn') as HTMLButtonElement;

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
const podiumDiv = document.getElementById('podium') as HTMLDivElement;
const finalStatsDiv = document.getElementById('final-stats') as HTMLDivElement;

// Report Elements
const reportBtnWrapper = document.getElementById('report-btn-wrapper') as HTMLDivElement;
const reportBtn = document.querySelector('.report-btn') as HTMLDivElement;
const reportModal = document.getElementById('report-modal') as HTMLDivElement;
const playerReportList = document.getElementById('player-report-list') as HTMLDivElement;
const closeModalBtn = document.getElementById('close-modal-btn') as HTMLButtonElement;

// Navigation
const goToLoginBtn = document.getElementById('go-to-login-btn') as HTMLButtonElement;
const goToHowBtn = document.getElementById('go-to-how-btn') as HTMLButtonElement;
const backToWelcomeBtn = document.getElementById('back-to-welcome-btn') as HTMLButtonElement;
const backFromLoginBtn = document.getElementById('back-from-login-btn') as HTMLButtonElement;

let socket: WebSocket | null = null;
let myNickname = "";
let myPlayerId = "";
let isAdminMode = false;
let lastRoomState: RoomState | null = null;

// --- SOUNDS (ALERES E ALTOS) ---
const AudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

function playSound(type: 'click' | 'success' | 'phase' | 'warning') {
  if (AudioCtx.state === 'suspended') AudioCtx.resume();
  const osc = AudioCtx.createOscillator();
  const gain = AudioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(AudioCtx.destination);
  
  const now = AudioCtx.currentTime;

  switch(type) {
    case 'click':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
      break;
    case 'success':
      osc.type = 'sine';
      // Melodia alegre (C E G C)
      [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
        const t = now + i * 0.1;
        osc.frequency.setValueAtTime(f, t);
      });
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.start(now); osc.stop(now + 0.6);
      break;
    case 'phase':
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
      break;
    case 'warning':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
      break;
  }
}

// --- CONFETTI ---
function spawnConfetti() {
  for (let i = 0; i < 60; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 80%, 60%)`;
    confetti.style.animationDelay = Math.random() * 2 + 's';
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 5000);
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
  const hideReport = [screens.welcome, screens.howToPlay, screens.login, screens.gameOver];
  reportBtnWrapper.style.display = hideReport.includes(screen) ? 'none' : 'block';
  reportModal.style.display = 'none';
}

function updateUI(room: RoomState) {
  const me = room.players.find(p => p.id === myPlayerId);
  const isMeHost = me?.isHost || false;

  if (lastRoomState?.state !== room.state) {
    playSound('phase');
    if (room.state === GameState.GAME_OVER) { playSound('success'); spawnConfetti(); }
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
      const choices = room.responses?.filter(res => res.id !== myPlayerId);
      if (!choices || choices.length === 0) {
        showScreen(screens.waiting);
        document.getElementById('waiting-message')!.innerText = `Aguardando votos...`;
      } else {
        choices.forEach((res: AnonymousResponse) => {
          const btn = document.createElement('button');
          btn.className = 'vote-card';
          btn.innerText = res.text;
          btn.onclick = () => { 
            playSound('click'); 
            socket?.send(JSON.stringify({ type: GameEventType.SUBMIT_VOTE, payload: { responseId: res.id } })); 
            showScreen(screens.waiting); 
          };
          votingListDiv.appendChild(btn);
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
            <div style="font-size:0.7rem; opacity:0.5; text-transform:uppercase;">${res.authorNickname}</div>
            <div style="font-size:1.1rem; font-weight:800;">${res.text}</div>
          </div>
          <div class="score-badge">+${res.voteCount * 10}</div>
        `;
        resultsListDiv.appendChild(card);
      });
      resultsControls.style.display = isMeHost ? 'block' : 'none';
      break;

    case GameState.GAME_OVER:
      showScreen(screens.gameOver);
      const sorted = [...room.players].sort((a, b) => b.score - a.score);
      podiumDiv.innerHTML = '';
      [1, 0, 2].forEach(idx => {
        const p = sorted[idx];
        if (!p) return;
        const place = document.createElement('div');
        place.className = `podium-place podium-${idx + 1}`;
        place.innerHTML = `
          <div class="podium-crown">${idx === 0 ? '👑' : idx === 1 ? '🥈' : '🥉'}</div>
          <div class="podium-name">${p.nickname}</div>
          <div class="podium-score">${p.score} pts</div>
        `;
        podiumDiv.appendChild(place);
      });
      finalStatsDiv.innerHTML = sorted.slice(3).map(p => `
        <div class="result-card" style="border-left:none; background:rgba(255,255,255,0.02)">
          <span>${p.nickname}</span>
          <span style="opacity:0.5">${p.score} pts</span>
        </div>
      `).join('');
      backToLobbyBtn.style.display = isMeHost ? 'block' : 'none';
      break;
  }
}

// --- NAV & ACTIONS ---
goToLoginBtn.onclick = () => { playSound('click'); showScreen(screens.login); };
goToHowBtn.onclick = () => { playSound('click'); showScreen(screens.howToPlay); };
backToWelcomeBtn.onclick = () => { playSound('click'); showScreen(screens.welcome); };
backFromLoginBtn.onclick = () => { playSound('click'); showScreen(screens.welcome); };
exitGameBtn.onclick = () => { playSound('click'); socket?.close(); showScreen(screens.welcome); };
backToLobbyBtn.onclick = () => { playSound('click'); socket?.send(JSON.stringify({ type: GameEventType.RESET_GAME, payload: {} })); };

reportBtn.onclick = () => {
  playSound('click');
  if (!lastRoomState) return;
  playerReportList.innerHTML = '';
  lastRoomState.players.forEach(p => {
    if (p.id === myPlayerId || p.isHost) return;
    const item = document.createElement('div');
    item.className = 'report-item';
    item.innerText = p.nickname;
    item.onclick = () => { socket?.send(JSON.stringify({ type: GameEventType.REPORT_PLAYER, payload: { playerId: p.id } })); reportModal.style.display = 'none'; };
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
  socket.onclose = () => { showScreen(screens.welcome); showToast("Conexão encerrada.", "error"); };
};

startBtn.onclick = () => { playSound('click'); socket?.send(JSON.stringify({ type: GameEventType.START_GAME, payload: {} })); };
resetBtn.onclick = () => { playSound('click'); socket?.send(JSON.stringify({ type: GameEventType.RESET_GAME, payload: {} })); };
nextRoundBtn.onclick = () => { playSound('click'); socket?.send(JSON.stringify({ type: GameEventType.NEXT_ROUND, payload: {} })); };
submitPromptBtn.onclick = () => {
  playSound('click');
  const prompt = promptInput.value.trim();
  if (prompt) socket?.send(JSON.stringify({ type: GameEventType.SUBMIT_PROMPT, payload: { prompt } }));
};
submitResponseBtn.onclick = () => {
  playSound('click');
  const response = responseInput.value.trim();
  if (response) socket?.send(JSON.stringify({ type: GameEventType.SUBMIT_RESPONSE, payload: { response } }));
};
