const Crawler = require("crawler");

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

  const getNextAvailableAppointments = async (url) => {
    const response = await directCrawler(url);
    
    const regex = /JSON\.parse\((.*)\);/gm;
    
    const matches = response.body.match(regex).map(match => {
      let jsonString = match.replace('JSON.parse(\"', '');
      jsonString = jsonString.replace('\");', '');
      jsonString = jsonString.replace(/\\/g, '');
      return JSON.parse(jsonString);
    }).filter(match => Object.keys(match).length !== 0);
    
    const { providerLocations } = matches[0].search.searchdata.search.data.search.searchResponse;
    
    const nextAvailabilities = providerLocations.filter(location => location.nextAvailability.startTime !== '');

    return nextAvailabilities;
  };

  module.exports = {
    getNextAvailableAppointments
  };