const prompt = require('prompt');
const path = require('path');
const async = require('async');
const fs = require('fs');

const fileLogic = require('../file');
const sentimentLogic = require('./sentiment');
const temporalLogic = require('./temporal');
const precompute = require('../analysis/precompute');
const cosineLogic = require('./cosine');

const runExperiment = (startIndex, endIndex, simFunc, windowSize, outputFileName) => {
  const expStart = new Date();
  const dataDirectory = path.join(process.env.HOME, 'entity-analysis-2');
  const timeRangeFilePath = path.join(process.env.HOME, 'tr-data.json');
  const matchingResults = [];
  const errors = [];
  const processStart = new Date();
  const totalUserList = fileLogic.getUserIdList();
  const candidateList = totalUserList.slice(startIndex, endIndex);
  const toMatchList = totalUserList.slice(0, totalUserList.length);
  console.time('Calc time range');
  const timeRangeData = precompute.readTrData();
  console.timeEnd('Calc time range');

  async.forEachOfSeries(candidateList, (userId, index, callback) => {
    const startTime = new Date();
    console.log(`\nExecuting task: ${index}`);
    console.log(`Starting matching for : ${userId}`);
    simFunc(userId, toMatchList, timeRangeData, windowSize, (err, res) => {
      if (err) {
        console.log(err);
        errors.push({
          userId,
          err,
        });
        callback();
        return;
      }

      console.log(`Required time for completion = ${(new Date().getTime() - startTime.getTime()) / 1000}s`);
      const result = {
        userId,
        res,
      };

      const resultStr = JSON.stringify(result, null, 2);

      const resultPath = path.join(process.env.HOME, `/${outputFileName}/${userId}`);
      fileLogic.writeFile(resultPath, resultStr, callback);
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

    console.log(`Start time: ${expStart}`);
    console.log(`Finish time: ${new Date()}`);
    console.log('Tasks executed successfully');
  });
}

prompt.get(['start', 'end', 'which', 'windowSize', 'outputFileName'], function(err, result) {
  const start = parseInt(result.start, 10);
  const end = parseInt(result.end, 10);
  const whichExp = result.which;
  const windowSize = parseInt(result.windowSize, 10);
  const outputFileName = result.outputFileName;

  let simFunc = temporalLogic.generateEntitySimilarityRankingWithTwitter;

  if (whichExp === 's') {
    simFunc = sentimentLogic.generateEntitySimilarityRankingWithTwitter;
  }

  if (whichExp === 'c') {
    simFunc = cosineLogic.generateEntitySimilarityRankingWithTwitter;
  }

  runExperiment(start, end, simFunc, windowSize, outputFileName);
});

// const numUsers = 1;
// const whichExp = 'c'
// const windowSize = 7;
// const outputFileName = 'cosine-7-ov';
// const numToMatch = 1900;

// let simFunc = temporalLogic.generateEntitySimilarityRankingWithTwitter;

// if (whichExp === 's') {
//   simFunc = sentimentLogic.generateEntitySimilarityRankingWithTwitter;
// }

// if (whichExp === 'c') {
//   simFunc = cosineLogic.generateEntitySimilarityRankingWithTwitter;
// }

// runExperiment(numUsers, simFunc, windowSize, outputFileName);
