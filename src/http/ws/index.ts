export { registerWebSocket } from './websocket.js';
export {
  addConnection,
  removeConnection,
  getConnectionByUserId,
  updateConnectionActivity,
  sendToSession,
  sendToUser,
  getAllConnections,
  cleanupInactiveConnections,
} from './connection-manager.js';
export type {
  ClientMessage,
  ClientMessageType,
  ServerMessage,
  ServerMessageType,
  WebSocketConnection,
} from './types.js';
