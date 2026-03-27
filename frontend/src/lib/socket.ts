import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(email?: string): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      path: '/wiki/socket.io',
      auth: { email },
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
