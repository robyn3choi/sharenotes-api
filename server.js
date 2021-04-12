require('dotenv').config();
const WebSocket = require('ws');
const express = require('express');
const MongoClient = require('mongodb').MongoClient;

const dbUri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ucwi3.mongodb.net/test?retryWrites=true&w=majority`;
const client = new MongoClient(dbUri, { useNewUrlParser: true, useUnifiedTopology: true });

let currentNoteValue = null;
let currentNoteId = '';
let dbWritePromise;

client.connect((err) => {
  if (err) return console.error(err);

  const db = client.db('sharenotes');
  const noteCollection = db.collection('notes');

  const app = express();
  app.use(express.json());

  app.get('/', async (req, res) => {
    // TODO: find the correct document when we have more than one
    try {
      await dbWritePromise;
      const notes = await noteCollection.find().toArray();
      if (notes.length) {
        currentNoteId = notes[0]._id;
        currentNoteValue = currentNoteValue || notes[0].value;
      }
      res.send({ value: currentNoteValue });
    } catch (err) {
      console.error(err);
    }
  });

  const server = app.listen(3001, function () {
    console.log('server listening on 3001');
  });

  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('websocket connection opened');

    ws.on('message', (msg) => {
      currentNoteValue = msg;
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(msg);
        }
      });
    });

    ws.on('close', async (ws) => {
      console.log('websocket connection closed');
      if (wss.clients.size === 0) {
        try {
          dbWritePromise = saveNoteToDb();
        } catch (err) {
          console.error(err);
        }
      }
    });

    async function saveNoteToDb() {
      const documentCount = await noteCollection.estimatedDocumentCount();
      const value = currentNoteValue;
      currentNoteValue = '';
      if (documentCount === 0) {
        return noteCollection.insertOne({ value });
      }
      const filter = { _id: currentNoteId };
      const update = { $set: { value } };
      return await noteCollection.updateOne(filter, update);
    }
  });
});
