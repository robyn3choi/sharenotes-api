require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const cors = require('cors');
const MongoClient = require('mongodb').MongoClient;

const dbUri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ucwi3.mongodb.net/test?retryWrites=true&w=majority`;
const client = new MongoClient(dbUri, { useNewUrlParser: true, useUnifiedTopology: true });

let roomNoteCache = {};
let dbWritePromise;

client.connect((err) => {
  if (err) return console.error(err);

  const db = client.db('sharenotes');
  const noteCollection = db.collection('notes');

  //// Express.js

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

      const noteId = req.query.noteId;
      const savedNote = await noteCollection.findOne({ noteId });
      const noteValue = roomNoteCache[noteId] || savedNote.value || '';
      roomNoteCache[noteId] = noteValue;
      res.send({ value: noteValue });
    } catch (err) {
      console.error(err);
    }
  });

  const server = app.listen(3001, function () {
    console.log('server listening on 3001');
  });

  //// Socket.io

  const io = require('socket.io')(server, { transports: ['websocket']});

  io.on('connection', (socket) => {
    console.log('socket opened');

    const noteId = socket.handshake.query.noteId;
    socket.join(noteId);

    socket.on('message', (msg) => {
      roomNoteCache[noteId] = msg;
      socket.to(noteId).emit('message', msg);
    });

    socket.on('disconnect', async (ws) => {
      console.log('socket closed');

      const doesRoomExist = io.sockets.adapter.rooms.get(noteId);
      if (!doesRoomExist) {
        console.log('no more users on:', noteId);
        try {
          dbWritePromise = saveNoteToDb(noteId);
        } catch (err) {
          console.error(err);
        }
      }
    });
  });

  async function saveNoteToDb(noteId) {
    const value = roomNoteCache[noteId];
    delete roomNoteCache[noteId];
    return await noteCollection.updateOne({ noteId }, { $set: { value } });
  }
});
