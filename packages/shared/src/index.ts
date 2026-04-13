/**
 * Estados principais do ciclo de jogo "E se..."
 */
export enum GameState {
  LOBBY = 'LOBBY',
  PROMPT_PHASE = 'PROMPT_PHASE',     
  RESPONSE_PHASE = 'RESPONSE_PHASE', 
  VOTING_PHASE = 'VOTING_PHASE',     
  RESULTS_PHASE = 'RESULTS_PHASE',   
  GAME_OVER = 'GAME_OVER'            
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
 * Interface para uma resposta anônima que vai para o frontend
 */
export interface AnonymousResponse {
  id: string;
  text: string;
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
  responses?: AnonymousResponse[]; // Respostas anônimas para votação
}

/**
 * Estrutura base de uma mensagem WebSocket
 */
export interface SocketMessage<T = any> {
  type: string;
  payload: T;
}

/**
 * Tipos de eventos WebSocket
 */
export enum GameEventType {
  // Client -> Server
  JOIN_ROOM = 'JOIN_ROOM',
  START_GAME = 'START_GAME',
  SUBMIT_PROMPT = 'SUBMIT_PROMPT',
  SUBMIT_RESPONSE = 'SUBMIT_RESPONSE',
  SUBMIT_VOTE = 'SUBMIT_VOTE',
  KICK_PLAYER = 'KICK_PLAYER',
  RESET_GAME = 'RESET_GAME',

  // Server -> Client
  ROOM_STATE_UPDATE = 'ROOM_STATE_UPDATE',
  ERROR = 'ERROR'
}
