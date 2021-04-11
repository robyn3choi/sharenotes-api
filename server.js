require('dotenv').config();
const express = require('express');
const app = express();
const MongoClient = require('mongodb').MongoClient;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ucwi3.mongodb.net/test?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
client.connect((err) => {
  if (err) return console.error(err);

  console.log('Connected to Database');

  const db = client.db('sharenotes');
  const textCollection = db.collection('text');

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

  app.listen(3001, function () {
    console.log('listening on 3001');
  });
});
