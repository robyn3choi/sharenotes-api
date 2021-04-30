import { Server as HttpServer } from 'http';
import { Server, ServerOptions, Socket } from 'socket.io';
import { UpdateWriteOpResult } from 'mongodb';

export default class SocketManager {
  roomNoteCache: Map<string, string>;
  saveNoteToDb: (noteId: string) => Promise<UpdateWriteOpResult>;

  constructor(
    httpServer: HttpServer,
    roomNoteCache: Map<string, string>,
    saveNoteToDb: (noteId: string) => Promise<UpdateWriteOpResult>
  ) {
    this.roomNoteCache = roomNoteCache;
    this.saveNoteToDb = saveNoteToDb;

    this.initializeSocketServer(httpServer);
  }

  initializeSocketServer(httpServer: HttpServer) {
    const ioOptions: Partial<ServerOptions> = {
      transports: ['websocket'],
      cors: { origin: '*', methods: ['GET', 'POST'] },
    };
    const io = new Server(httpServer, ioOptions);

    io.on('connection', (socket) => {
      console.log('socket opened');
      const noteId = socket.handshake.query.noteId as string;
      socket.join(noteId);

      socket.on('message', (msg) => this.handleReceiveMessage(socket, msg, noteId));
      socket.on('disconnect', async () => this.handleDisconnect(io, noteId));
    });
  }

  handleReceiveMessage(socket: Socket, msg: string, noteId: string) {
    this.roomNoteCache.set(noteId, msg);
    socket.to(noteId).emit('message', msg);
  }

  async handleDisconnect(io: Server, noteId: string) {
    console.log('socket closed');
    const doesRoomExist = io.sockets.adapter.rooms.get(noteId);
    if (!doesRoomExist) {
      console.log('no more users on:', noteId);
      try {
        this.saveNoteToDb(noteId);
      } catch (err) {
        console.error(err);
      }
    }
  }
}
