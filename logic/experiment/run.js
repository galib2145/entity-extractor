const prompt = require('prompt');
const path = require('path');
const async = require('async');
const fs = require('fs');

const fileLogic = require('../file');
const sentimentLogic = require('./sentiment');
const temporalLogic = require('./temporal');
const cosineLogic = require('./cosine');

const runExperiment = (numCandidates, numToMatch, simFunc, windowSize, outputFileName) => {
  const dataDirectory = path.join(process.env.HOME, 'entity-analysis-2');
  const matchingResults = [];
  const errors = [];
  const processStart = new Date();
  const totalUserList = fileLogic.getUserIdList();
  const candidateList = totalUserList.slice(0, numCandidates);
  const toMatchList = totalUserList.slice(0, numToMatch);

  async.forEachOfSeries(candidateList, (userId, index, callback) => {
    const startTime = new Date();
    console.log(`\nExecuting task: ${index}`);
    console.log(`Starting matching for : ${userId}`);
    simFunc(userId, toMatchList, windowSize, (err, res) => {
      if (err) {
        console.log(err);
        errors.push({
          userId,
          err,
        });
        callback();
        return;
      }

      console.log(`Diff = ${(new Date().getTime() - startTime.getTime()) / 1000}s`);
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

    console.log('Tasks executed successfully');
  });
}

// prompt.get(['numUsers', 'which', 'windowSize', 'numToMatch', 'outputFileName'], function (err, result) {
//   const numUsers = parseInt(result.numUsers, 10);
//   const whichExp = result.which;
//   const windowSize = parseInt(result.windowSize, 10);
//   const outputFileName = result.outputFileName;
//   const numToMatch = parseInt(result.numToMatch, 10);

//   let simFunc = temporalLogic.generateEntitySimilarityRankingWithTwitter;

//   if (whichExp === 's') {
//     simFunc = sentimentLogic.generateEntitySimilarityRankingWithTwitter;
//   }

//   if (whichExp === 'c') {
//     simFunc = cosineLogic.generateEntitySimilarityRankingWithTwitter;
//   }

//   runExperiment(numUsers, numToMatch, simFunc, windowSize, outputFileName);
// });

const numUsers = 1;
const whichExp = 't'
const windowSize = 7;
const outputFileName = 'test';
const numToMatch = 1900;

let simFunc = temporalLogic.generateEntitySimilarityRankingWithTwitter;

if (whichExp === 's') {
  simFunc = sentimentLogic.generateEntitySimilarityRankingWithTwitter;
}

if (whichExp === 'c') {
  simFunc = cosineLogic.generateEntitySimilarityRankingWithTwitter;
}

runExperiment(numUsers, numToMatch, simFunc, windowSize, outputFileName);