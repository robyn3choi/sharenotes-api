import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { MongoClient, UpdateWriteOpResult } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import SocketService from './SocketService';

dotenv.config();

const dbUri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ucwi3.mongodb.net/test?retryWrites=true&w=majority`;
const client = new MongoClient(dbUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let roomNoteCache = new Map<string, string>();
let dbWritePromise: Promise<UpdateWriteOpResult>;

client.connect((err) => {
  if (err) return console.error(err);

  // MongoDB
  const db = client.db('sharenotes');
  const noteCollection = db.collection('notes');

  // Express.js
  const app = express();
  app.use(express.json());
  app.use(cors());

  app.post('/create', async (req, res) => {
    try {
      const noteId = uuidv4();
      const newNote = { noteId, value: '' };
      await noteCollection.insertOne(newNote);
      res.send({ noteId });
    } catch (err) {
      console.error(err);
    }
  });

  app.get('/', async (req, res) => {
    try {
      await dbWritePromise; // wait for db write to finish before querying db

      const noteId = req.query.noteId as string;
      const savedNote = await noteCollection.findOne({ noteId });
      const noteValue = roomNoteCache.get(noteId) || savedNote.value || '';
      roomNoteCache.set(noteId, noteValue);
      res.send({ value: noteValue });
    } catch (err) {
      console.error(err);
    }
  });

  const server = app.listen(3001, function () {
    console.log('server listening on 3001');
  });

  async function saveNoteToDb(noteId: string) {
    const value = roomNoteCache.get(noteId);
    roomNoteCache.delete(noteId);
    return await noteCollection.updateOne({ noteId }, { $set: { value } });
  }

  const socketService = new SocketService(server, roomNoteCache, saveNoteToDb);
  socketService.initializeServer();
});
