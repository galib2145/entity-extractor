const fs = require('fs');
const request = require('request');
var querystring = require('querystring');
const async = require('async');
const mkdirp = require('mkdirp');

const logics = require('./logics');
const twitterAnalysisLogic = require('./twitterAnalysisLogic');
const rootDirectory = '/home/saad/media';
const outputDirectory = '/home/saad/entity-analysis';
const userDirectories = logics.getDirectories(rootDirectory);

const analysisTask = (userDirectory, taskIndex, callback) => {
  console.log(`\nExecuting task: ${taskIndex}`);
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


async.forEachOfSeries(userDirectories.slice(1350, 1500), analysisTask, (err) => {
  if (err) {
    console.log(err.message);
    return;
  }

  console.log('Tasks executed successfully');
});

// twitterAnalysisLogic.getTwitterAnalysisForUser('/home/saad/media/18_reinout', (err, result) => {
//     if (err) {
//       callbassck(err);
//       return;
//     }

//     console.log(JSON.stringify(result, null, 2));
// });

