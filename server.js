require('dotenv').config();
const WebSocket = require('ws');
const express = require('express');
const MongoClient = require('mongodb').MongoClient;

const dbUri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ucwi3.mongodb.net/test?retryWrites=true&w=majority`;
const client = new MongoClient(dbUri, { useNewUrlParser: true, useUnifiedTopology: true });

client.connect((err) => {
  if (err) return console.error(err);

  console.log('Connected to Database');

  const db = client.db('sharenotes');
  const textCollection = db.collection('text');

  const app = express();
  app.use(express.json());

  app.get('/', (req, res) => {
    db.collection('text')
      .find()
      .toArray()
      .then((results) => {
        res.send(results);
      })
      .catch((error) => console.error(error));
  });

  app.post('/new', (req, res) => {
    textCollection
      .insertOne(req.body)
      .then((result) => {
        console.log(result);
        res.redirect('/');
      })
      .catch((error) => console.error(error));
  });

  const server = app.listen(3001, function () {
    console.log('ws listening on 3001');
  });

  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    //connection is up, let's add a simple simple event
    ws.on('message', (message) => {
      //log the received message and send it back to the client
      console.log('received: %s', message);
      ws.send(`Hello, you sent -> ${message}`);
    });

    //send immediatly a feedback to the incoming connection
    ws.send('Hi there, I am a WebSocket server');
  });
});
