export { registerWebSocket } from './websocket.js';
export {
  addConnection,
  removeConnection,
  getConnection,
  getConnectionByUserId,
  updateConnectionActivity,
  sendToSession,
  sendToUser,
  broadcast,
  getConnectionCount,
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
