const fetch = require('node-fetch');
const Crawler = require("crawler");
const { readFile } = require('fs').promises;

const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const fromPhoneNumber = process.env.TWILIO_FROM_NUMBER || '';
const client = require('twilio')(accountSid, authToken);

var crawler = new Crawler({
  maxConnections: 10,
  // This will be called for each crawled page
  callback: function (error, res, done) {
    if (error) {
      console.log(error);
    } else {
      var $ = res.$;
      // $ is Cheerio by default
      //a lean implementation of core jQuery designed specifically for the server
      console.log(
        $("body")
          .text()
          .match(
            new RegExp(
              'nextAvailability":{"startTime":"","__typename":"Timeslot"}'
            )
          )
      );
    }
    done();
  },
});

const directCrawler = async (url) => {
  return new Promise((resolve, reject) => {
    crawler.direct({
      uri: url,
      skipEventRequest: false, // default to true, direct requests won't trigger Event:'request'
      callback: function (error, response) {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      },
    });
  });
}

(async () => {
  const url = 'https://www.zocdoc.com/vaccine/search/IL?flavor=state-search';
  const response = await directCrawler(url);

  console.log(`response: ${JSON.stringify(response)}`);

  const regex = /JSON\.parse\((.*)\);/gm;

  const matches = response.body.match(regex).map(match => {
    let jsonString = match.replace('JSON.parse(\"', '');
    jsonString = jsonString.replace('\");', '');
    jsonString = jsonString.replace(/\\/g, '');
    return JSON.parse(jsonString);
  }).filter(match => Object.keys(match).length !== 0);

  console.log(`matches: ${JSON.stringify(matches)}`);

  const { providerLocations } = matches[0].search.searchdata.search.data.search.searchResponse;

  console.log(`providerLocations: ${providerLocations}`);

  const nextAvailabilities = providerLocations.filter(location => location.nextAvailability.startTime !== '');

  console.log(`nextAvailabilities: ${nextAvailabilities}`);

  if (nextAvailabilities.length > 0) {
    const peopleRawData = await readFile('people.json');
    const people = JSON.parse(peopleRawData).people;

    await Promise.all(people.map(person => {
      console.log(`Notifying ${JSON.stringify(person)}`);
      return client.messages
        .create({
          body: `Hey ${person.firstName}! A vaccine appointment is available, go to ${url} to book it!`,
          from: fromPhoneNumber,
          to: person.phoneNumber
        });
    }));
  }
})();
