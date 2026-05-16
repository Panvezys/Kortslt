import { io, type Socket } from "socket.io-client";

let _socket: Socket | null = null;

/**
 * Returns the shared socket.io-client singleton.
 * The socket is created lazily and starts in disconnected state (autoConnect: false).
 * Call connectSocket() once Clerk auth is ready to actually open the connection.
 */
export function getSocket(): Socket {
  if (!_socket) {
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    _socket = io({
      // Socket.IO path — must match the server's default (/socket.io/).
      // In dev the Vite proxy forwards this path to localhost:8080 with ws:true.
      // In production the Express server handles it directly on the same port.
      path: `${base}/socket.io/`,
      transports: ["websocket", "polling"],
      autoConnect: false,
      withCredentials: true,
    });
  }
  return _socket;
}

export type { Socket };
