/**
 * Estados principais do ciclo de jogo "E se..."
 */
export enum GameState {
  LOBBY = 'LOBBY',
  PROMPT_PHASE = 'PROMPT_PHASE',     // Alguém cria a ocasião
  RESPONSE_PHASE = 'RESPONSE_PHASE', // Outros enviam respostas
  VOTING_PHASE = 'VOTING_PHASE',     // Todos votam
  RESULTS_PHASE = 'RESULTS_PHASE',   // Revelação e Placar
  GAME_OVER = 'GAME_OVER'            // Fim de jogo
}

/**
 * Interface para um jogador
 */
export interface Player {
  id: string;
  nickname: string;
  score: number;
  isHost: boolean;
  connected: boolean;
}

/**
 * Interface para o estado de uma sala
 */
export interface RoomState {
  code: string;
  state: GameState;
  players: Player[];
  currentRound: number;
  maxRounds: number;
  currentPrompt?: string;
  promptCreatorId?: string;
}

/**
 * Estrutura base de uma mensagem WebSocket
 */
export interface SocketMessage<T = any> {
  type: string;
  payload: T;
}

/**
 * Tipos de eventos WebSocket (Client -> Server e Server -> Client)
 */
export enum GameEventType {
  // Client -> Server
  JOIN_ROOM = 'JOIN_ROOM',
  START_GAME = 'START_GAME',
  SUBMIT_PROMPT = 'SUBMIT_PROMPT',
  SUBMIT_RESPONSE = 'SUBMIT_RESPONSE',
  SUBMIT_VOTE = 'SUBMIT_VOTE',

  // Server -> Client
  ROOM_STATE_UPDATE = 'ROOM_STATE_UPDATE',
  ERROR = 'ERROR'
}
