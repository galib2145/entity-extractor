const fs = require('fs');
const request = require('request');
var querystring = require('querystring');
const async = require('async');
const mkdirp = require('mkdirp');

const logics = require('./logics');
const twitterAnalysisLogic = require('./twitterAnalysisLogic');
const rootDirectory = '/home/saad-galib/media';
const outputDirectory = '/home/saad-galib/entity-analysis-per-post';
const userDirectories = logics.getDirectories(rootDirectory);
const tenMinutes = 10 * 60 * 1000;

const analysisTask = (userDirectory, taskIndex, callback) => {
  const time = new Date();
  console.log(`\nExecuting task: ${taskIndex}`);
  console.log(`Start time: ${time}`);
  console.log(`Directory: ${userDirectory}`);
  twitterAnalysisLogic.getTwitterAnalysisForUser(userDirectory, (err, result) => {
    if (err) {
      console.log(err.message);
      if (err.message === 'No twitter text found!') {
        callback();
        return;
      }

      callback(err);
      return;
    }

    const userId = userDirectory.split('/')[4];
    const filePath = `${outputDirectory}/${userId}/twitter.json`;
    mkdirp.sync(`${outputDirectory}/${userId}`);
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    callback();
  });
};

async.forEachOfSeries(userDirectories.slice(1100, 1500), analysisTask, (err) => {
  if (err) {
    console.log(err);
    return;
  }

  console.log('Tasks executed successfully');
});
