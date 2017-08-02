const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const async = require('async');

const sentimentLogic = require('../experiment/sentiment');

const getRunDataFromTemporalResult = (callback) => {
  const dir = `/res/match`;
  const filePath = path.join(process.env.HOME, dir);
  fs.readFileAsync(filePath)
    .then((fileContent) => {
      const resultData = JSON.parse(fileContent);
      const dataForRun = resultData.map((r) => {
        const userData = {};
        userData.id = r.userId;
        userData.matchCandidates = r.res.slice(0, 20).map(c => c.user);
        return userData;
      });
      callback(null, dataForRun);
    })
    .catch((err) => callback(err));
};

const getRunDataFromTemporalResultAsync = Promise.promisify(getRunDataFromTemporalResult);
const processStart = new Date();

getRunDataFromTemporalResultAsync()
  .then((runData) => {
    const matchingResults = [];
    const errors = [];
    async.forEachOfSeries(runData, (r, index, callback) => {
      const userId = r.id;
      const userList = r.matchCandidates;
      console.log(`\nStarting matching for : ${userId}`);
      console.log(`Start time: ${new Date()}`);
      sentimentLogic.generateEntitySimilarityRankingWithTwitter(userId, userList, (err, res) => {
        if (err) {
          console.log(err);
          errors.push({
            userId,
            err,
          });
          callback();
          return;
        }

        console.log(`End time : ${new Date()}`);
        matchingResults.push({
          userId,
          res,
        });

        callback();
      });
    }, (err) => {
      if (err) {
        console.log(err.message);
        return;
      }

      fs.writeFileSync(
        path.join(path.join(process.env.HOME, '/res/error-sentiment-2')),
        JSON.stringify(errors, null, 2)
      );
      fs.writeFileSync(
        path.join(path.join(process.env.HOME, '/res/match-sentiment-2')),
        JSON.stringify(matchingResults, null, 2)
      );

      console.log(`\nStart time: ${processStart}`);
      console.log(`End time : ${new Date()}`);
      console.log('Tasks executed successfully');
    });
  });
