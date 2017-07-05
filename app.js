const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const request = require('request');
var querystring = require('querystring');
const async = require('async');
const mkdirp = Promise.promisifyAll(require('mkdirp'));

const twitterLogic = Promise.promisifyAll(require('./logic/analysis/twitter.js'));
const disqusLogic = Promise.promisifyAll(require('./logic/analysis/disqus.js'));

const rootDirectory = '/home/saad-galib/media';
const outputDirectory = '/home/saad-galib/entity-analysis-2';


const analysisTask = (userDirectory, taskIndex, callback) => {
  let time = new Date();
  let twitterAnalysisString = null;
  let disqusAnalysisString = null;
  const userId = userDirectory.split('/')[4];
  const baseAnalysisDirectory = `${outputDirectory}/${userId}`;
  const twitterFilePath = `${baseAnalysisDirectory}/twitter.json`;
  const disqusFilePath = `${baseAnalysisDirectory}/disqus.json`;

  console.log(`\nExecuting task: ${taskIndex}`);
  console.log(`Start time: ${time}`);
  console.log(`Directory: ${userDirectory}`);

  twitterLogic.getTwitterAnalysisForUserAsync(userDirectory)
    .then((result) => {
      twitterAnalysisString = JSON.stringify(result, null, 2);
      return disqusLogic.getDisqusAnalysisForUserAsync(userDirectory);
    })
    .then((result) => {
      disqusAnalysisString = JSON.stringify(result, null, 2);
      return mkdirp.mkdirpAsync(baseAnalysisDirectory);
    })
    .then(() => {
      const fileWriteTasks = [
        fs.writeFileAsync(twitterFilePath, twitterAnalysisString),
        fs.writeFileAsync(disqusFilePath, disqusAnalysisString),
      ];

      return Promise.all(fileWriteTasks);
    })
    .then(() => {
      console.log(`End time: ${new Date()}`);
      callback();
    })
    .catch((err) => {
      callback(err);
    });
};

analysisTask('/home/saad-galib/media/1000_bigyahu', 1, (err) => {
  if (err) {
    console.log(err);
    return;
  }
  console.log('Task finished');
});
