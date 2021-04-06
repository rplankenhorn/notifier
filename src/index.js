require('dotenv').config()

const http = require('http');
const express = require('express');
const MongoClient = require('mongodb').MongoClient
const bodyParser = require('body-parser');
const MessagingResponse = require('twilio').twiml.MessagingResponse;

const { getNextAvailableAppointments } = require('./crawler');

const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const fromPhoneNumber = process.env.TWILIO_FROM_NUMBER || '';
const twilioClient = require('twilio')(accountSid, authToken);

const dbConnectionString = process.env.DB_URL || '';

let people;

(async () => {
  const dbClient = await MongoClient.connect(dbConnectionString, { useUnifiedTopology: true });

  console.log('Connected to Database');
  const db = dbClient.db('notifier');
  const peopleCollection = db.collection('people');

  const app = express();

  // parse application/x-www-form-urlencoded
  app.use(bodyParser.urlencoded({ extended: false }))

  // parse application/json
  app.use(bodyParser.json())

  app.post('/sms', async (req, res) => {
    const message = req.body.Body;
    const phoneNumber = req.body.From;

    if (message.toLowerCase().match(/(stop|stopall|unsubscribe|cancel|end|quit)/g)) {
      await peopleCollection.deleteOne({
        phoneNumber
      });

      res.writeHead(200, {'Content-Type': 'text/xml'});
      res.end();
    } else {
      const currentPhoneNumbers = await peopleCollection.findOne({ phoneNumber });

      let message = '';

      if (!currentPhoneNumbers) {
        await peopleCollection.insertOne({
          phoneNumber
        });

        message = 'You have been subscribed to the vaccine notifier.  You will receive text messages when vaccine appointments are available! Reply STOP to unsubscribe.';
      } else {
        message = 'You are already subscribed to the vaccine notifier.  You will receive text messages when vaccine appointments are available! Reply STOP to unsubscribe.';
      }

      const twiml = new MessagingResponse();

      twiml.message(message);

      res.writeHead(200, {'Content-Type': 'text/xml'});
      res.end(twiml.toString());
    }
  });

  http.createServer(app).listen(8080, () => {
    console.log('Express server listening on port 8080');
  });

  while(true) {    
    const currentDate = new Date();
    const hour = currentDate.getHours();
    console.log(hour);

    if (hour < 7 || hour > 22) {
      console.log("Do not disturb hours.  Skipping everything.");
      await new Promise((resolve, reject) => setTimeout(resolve, 1000 * 60));
      continue;
    }

    const url = `https://www.zocdoc.com/vaccine/search/IL?flavor=state-search`;
    const nextAvailabilities = await getNextAvailableAppointments(url);
    
    console.log(`nextAvailabilities: ${JSON.stringify(nextAvailabilities)}`);

    const people = await peopleCollection.find().toArray();
    
    if (nextAvailabilities.length > 0) {
      await Promise.all(people.map(person => {
        console.log(`Notifying ${JSON.stringify(person)}`);
        return twilioClient.messages
          .create({
            body: `Hey! A vaccine appointment is available, go to ${url} to book it!`,
            from: fromPhoneNumber,
            to: person.phoneNumber
          });
        }));
      
      console.log('Waiting 1 minute before resuming loop to prevent spam.')
      await new Promise((resolve, reject) => setTimeout(resolve, 1000 * 60));
    } else {
      await new Promise((resolve, reject) => setTimeout(resolve, 1000 * 10));
    }
  }
})();
