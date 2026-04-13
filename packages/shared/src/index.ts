export enum GameState {
  LOBBY = 'LOBBY',
  PROMPT_PHASE = 'PROMPT_PHASE',     
  RESPONSE_PHASE = 'RESPONSE_PHASE', 
  VOTING_PHASE = 'VOTING_PHASE',     
  RESULTS_PHASE = 'RESULTS_PHASE',   
  GAME_OVER = 'GAME_OVER'            
}

export interface Player {
  id: string;
  nickname: string;
  score: number;
  isHost: boolean;
  connected: boolean;
}

export interface AnonymousResponse {
  id: string;
  text: string;
}

export interface RoundResult {
  authorNickname: string;
  text: string;
  voteCount: number;
}

export interface RoomState {
  code: string;
  state: GameState;
  players: Player[];
  currentRound: number;
  maxRounds: number;
  currentPrompt?: string;
  promptCreatorId?: string;
  responses?: AnonymousResponse[]; 
  roundResults?: RoundResult[];
}

export interface SocketMessage<T = any> {
  type: string;
  payload: T;
}

export enum GameEventType {
  JOIN_ROOM = 'JOIN_ROOM',
  START_GAME = 'START_GAME',
  SUBMIT_PROMPT = 'SUBMIT_PROMPT',
  SUBMIT_RESPONSE = 'SUBMIT_RESPONSE',
  SUBMIT_VOTE = 'SUBMIT_VOTE',
  KICK_PLAYER = 'KICK_PLAYER',
  RESET_GAME = 'RESET_GAME',
  NEXT_ROUND = 'NEXT_ROUND',
  REPORT_PLAYER = 'REPORT_PLAYER',

  ROOM_STATE_UPDATE = 'ROOM_STATE_UPDATE',
  ERROR = 'ERROR',
  TOAST = 'TOAST' // Nova notificação temporária
}
