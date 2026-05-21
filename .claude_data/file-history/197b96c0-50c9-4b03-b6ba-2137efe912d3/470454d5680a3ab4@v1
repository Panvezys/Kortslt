import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { clerkClient } from "@clerk/express";
import { logger } from "./logger";

let io: SocketIOServer | null = null;

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: true, credentials: true },
    transports: ["websocket", "polling"],
  });

  // Auth middleware — runs before "connection" fires
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      const userId = socket.handshake.auth?.userId as string | undefined;

      // Agent bypass (dev / automated tests)
      const bypassKey = process.env.AGENT_BYPASS_KEY;
      if (bypassKey && socket.handshake.auth?.agentKey === bypassKey) {
        socket.data.userId = userId ?? "agent-test-user";
        return next();
      }

      // No Clerk secret in dev → trust the userId from the handshake
      if (!process.env.CLERK_SECRET_KEY) {
        socket.data.userId = userId ?? "anon";
        return next();
      }

      if (!token) return next(new Error("auth:no_token"));

      // clerkClient.verifyToken is available on @clerk/express v2+
      const payload = await (clerkClient as any).verifyToken(token) as { sub: string };
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("auth:invalid_token"));
    }
  });

  io.on("connection", (socket) => {
    const userId: string = socket.data.userId;

    // Every authenticated user is always subscribed to their own inbox room
    // so that unread_update events reach them regardless of which chat is open.
    socket.join(`inbox_${userId}`);
    logger.debug({ userId, id: socket.id }, "socket connected");

    // Clients emit this whenever they open a specific conversation.
    // The server adds the socket to the appropriate narrow room so future
    // new_message events are only delivered to sockets that care about them.
    socket.on("join_rooms", (params: {
      dmUserId?: string;
      courtId?: number;
      playerId?: string;
      gameId?: number;
    }) => {
      if (params.dmUserId) {
        socket.join(dmRoom(userId, params.dmUserId));
      }
      if (params.courtId != null && params.playerId) {
        socket.join(`facility_${params.courtId}_${params.playerId}`);
      }
      if (params.gameId != null) {
        socket.join(`game_${params.gameId}`);
      }
    });

    socket.on("leave_rooms", (params: {
      dmUserId?: string;
      courtId?: number;
      playerId?: string;
      gameId?: number;
    }) => {
      if (params.dmUserId) {
        socket.leave(dmRoom(userId, params.dmUserId));
      }
      if (params.courtId != null && params.playerId) {
        socket.leave(`facility_${params.courtId}_${params.playerId}`);
      }
      if (params.gameId != null) {
        socket.leave(`game_${params.gameId}`);
      }
    });

    socket.on("disconnect", () => {
      logger.debug({ userId, id: socket.id }, "socket disconnected");
    });
  });

  return io;
}

/** Emit to a room — safe to call even before initSocketIO (silently no-ops). */
export function socketEmit(room: string, event: string, data: unknown): void {
  try { io?.to(room).emit(event, data); } catch { /* ignore */ }
}

/** Canonical DM room name — sorts user IDs so both sides produce the same string. */
export function dmRoom(uid1: string, uid2: string): string {
  return `dm_${[uid1, uid2].sort().join("_")}`;
}
