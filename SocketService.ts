import { Server as HttpServer } from 'http';
import { Server, ServerOptions, Socket } from 'socket.io';
import { UpdateWriteOpResult } from 'mongodb';

export default class SocketService {
  private httpServer: HttpServer;
  private roomNoteCache: Map<string, string>;
  private saveNoteToDb: (noteId: string) => Promise<UpdateWriteOpResult>;

  constructor(
    httpServer: HttpServer,
    roomNoteCache: Map<string, string>,
    saveNoteToDb: (noteId: string) => Promise<UpdateWriteOpResult>
  ) {
    this.httpServer = httpServer;
    this.roomNoteCache = roomNoteCache;
    this.saveNoteToDb = saveNoteToDb;
  }

  initializeServer() {
    const ioOptions: Partial<ServerOptions> = {
      transports: ['websocket'],
      cors: { origin: '*', methods: ['GET', 'POST'] },
    };
    const io = new Server(this.httpServer, ioOptions);

    io.on('connection', (socket) => {
      console.log('socket opened');
      const noteId = socket.handshake.query.noteId as string;
      socket.join(noteId);

      socket.on('message', (msg) => this.handleReceiveMessage(socket, msg, noteId));
      socket.on('disconnect', async () => this.handleDisconnect(io, noteId));
    });
  }

  private handleReceiveMessage(socket: Socket, msg: string, noteId: string) {
    this.roomNoteCache.set(noteId, msg);
    socket.to(noteId).emit('message', msg);
  }

  private async handleDisconnect(io: Server, noteId: string) {
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
