import type { WebSocket } from 'ws';

// Client -> Server message types
export type ClientMessageType = 'message' | 'typing' | 'close' | 'pong';

export interface ClientMessageData {
  message: { text: string; replyTo?: string };
  typing: { isTyping: boolean };
  close: { resolved: boolean; feedback?: string };
  pong: { timestamp: number };
}

export interface ClientMessage<T extends ClientMessageType = ClientMessageType> {
  type: T;
  data: ClientMessageData[T];
}

// Server -> Client message types
export type ServerMessageType =
  | 'connected'
  | 'message'
  | 'typing'
  | 'status'
  | 'channel_linked'
  | 'error'
  | 'ping';

export interface ServerMessageData {
  connected: { sessionId: string; ticketStatus: string; unreadCount: number };
  message: {
    id: string;
    text: string;
    from: 'user' | 'support';
    channel: 'web' | 'telegram';
    timestamp: string;
    replyTo?: string;
  };
  typing: { isTyping: boolean };
  status: { status: string; assignedTo?: string };
  channel_linked: { telegram: string; historyCopied: boolean };
  error: { code: string; message: string };
  ping: { timestamp: number };
}

export interface ServerMessage<T extends ServerMessageType = ServerMessageType> {
  type: T;
  data: ServerMessageData[T];
}

// WebSocket connection with session info
export interface WebSocketConnection {
  ws: WebSocket;
  sessionId: string;
  userId: string;
  lastActivity: number;
}
