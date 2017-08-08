const prompt = require('prompt');
const path = require('path');
const async = require('async');
const fs = require('fs');

const fileLogic = require('../file');
const sentimentLogic = require('./sentiment');
const temporalLogic = require('./temporal');

const runExperiment = (numUsers, simFunc, windowSize, outputFileName) => {
  const dataDirectory = path.join(process.env.HOME, 'entity-analysis-2');
  const matchingResults = [];
  const errors = [];
  const processStart = new Date();
  const userIdList = fileLogic.getUserIdList().slice(0, numUsers);

  async.forEachOfSeries(userIdList, (userId, index, callback) => {
    const startTime = new Date();
    console.log(`\nStarting matching for : ${userId}`);
    simFunc(userId, userIdList, windowSize, (err, res) => {
      if (err) {
        errors.push({
          userId,
          err,
        });
        callback();
        return;
      }

      console.log(`Start time: ${startTime}`);
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
      path.join(path.join(process.env.HOME, `/res/error-${outputFileName}`)),
      JSON.stringify(errors, null, 2)
    );
    fs.writeFileSync(
      path.join(path.join(process.env.HOME, `/res/match-${outputFileName}`)),
      JSON.stringify(matchingResults, null, 2)
    );

    console.log(`\nStart time: ${processStart}`);
    console.log(`End time : ${new Date()}`);
    console.log('Tasks executed successfully');
  });
}

prompt.get(['numUsers', 'which', 'windowSize', 'outputFileName'], function(err, result) {
  const numUsers = parseInt(result.numUsers, 10);
  const whichExp = parseInt(result.which, 10);
  const windowSize = parseInt(result.windowSize, 10);
  const outputFileName = result.outputFileName;

  let simFunc = temporalLogic.generateEntitySimilarityRankingWithTwitter;

  if (whichExp === 's') {
    simFunc = sentimentLogic.generateEntitySimilarityRankingWithTwitter;
  }

  runExperiment(numUsers, simFunc, windowSize, outputFileName);
});
