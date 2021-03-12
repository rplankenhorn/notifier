var Crawler = require("crawler");
var player = require("play-sound")((opts = {}));
const { forever } = require("async");
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

player.play("./test.mp3");
// setTimeout(() => player.play("./alert.wav"), 1500);
// setTimeout(() => player.play("./alert.wav"), 3000);
// setTimeout(() => player.play("./alert.wav"), 4500);

forever(
  function (next) {
    crawler.direct({
      uri: "https://www.zocdoc.com/vaccine/search/IL?flavor=state-search",
      skipEventRequest: false, // default to true, direct requests won't trigger Event:'request'
      callback: function (error, response) {
        if (error) {
          console.log(error);
        } else {
          const matches = response.body.match(/nextAvailability\\\":{(.+?)}/g);

          matches.forEach((match, idx) => {
            if (
              match !==
              'nextAvailability\\":{\\"startTime\\":\\"\\",\\"__typename\\":\\"Timeslot\\"}'
            ) {
              console.log(match, Date.now().toLocaleString());
              player.play("./alert.mp3");
              setTimeout(() => player.play("./alert.mp3"), 1500);
              setTimeout(() => player.play("./alert.mp3"), 3000);
              setTimeout(() => player.play("./alert.mp3"), 4500);
            }
          });
        }
      },
    });
    setTimeout(next, 1000 * 10);
  },
  function (err) {
    process.exit(1);
  }
);
