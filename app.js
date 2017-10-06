const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const request = require('request');
var querystring = require('querystring');
const async = require('async');
const mkdirp = Promise.promisifyAll(require('mkdirp'));
const prompt = require('prompt');

const config = require('./config');

const twitterAnalysisLogic = Promise.promisifyAll(require('./logic/analysis/twitter.js'));
const disqusAnalysisLogic = Promise.promisifyAll(require('./logic/analysis/disqus.js'));
const genericLogic = Promise.promisifyAll(require('./logic/analysis/generic.js'));

const fileLogic = require('./logic/file');

const twitterPreprocessingLogic = require('./logic/preprocessing/twitter');
const disqusPreprocessingLogic = require('./logic/preprocessing/disqus');

const rootProfileDataDirectory = path.join(process.env.HOME, config.dir.profileData);
const outputDirectory = path.join(process.env.HOME, 'entity-analysis-2');

const errorReport = [];

const analysisTask = (userDirectory, taskIndex, callback) => {
  console.log(userDirectory);
  const userId = userDirectory.split('/')[4];

  if (!genericLogic.shouldUserBeAnalyzed(userId)) {
    console.log('This user does not have sufficient data!');
    callback();
    return;
  }

  let time = new Date();
  let twitterAnalysisString = null;
  let disqusAnalysisString = null;
  const baseAnalysisDirectory = `${outputDirectory}/${userId}`;
  const twitterFilePath = `${baseAnalysisDirectory}/twitter.json`;
  const disqusFilePath = `${baseAnalysisDirectory}/disqus.json`;

  console.log(`\nExecuting task: ${taskIndex}`);
  console.log(`Start time: ${time}`);
  console.log(`Directory: ${userDirectory}`);

  twitterAnalysisLogic.getTwitterAnalysisForUserAsync(userDirectory)
    .then((result) => {
      twitterAnalysisString = JSON.stringify(result, null, 2);
      return disqusAnalysisLogic.getDisqusAnalysisForUserAsync(userDirectory);
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
      const processedTwitter = twitterPreprocessingLogic.formatUserTwitterEntityAnalysis(userId, JSON.parse(twitterAnalysisString).analysis);
      const processedDisqus = disqusPreprocessingLogic.formatUserDisqusEntityAnalysis(userId, JSON.parse(disqusAnalysisString).analysis);
      const fileWriteTasks = [
        fs.writeFileAsync(`${baseAnalysisDirectory}/twitter-store`, JSON.stringify(processedTwitter, null, 2)),
        fs.writeFileAsync(`${baseAnalysisDirectory}/disqus-store`, JSON.stringify(processedDisqus, null, 2)),
      ];
      console.log(`End time: ${new Date()}`);
      callback();
    })
    .catch((err) => {
      console.log(err);
      console.log(`Analysis failed for user : ${userId}`);
      const error = {
        userId,
        error: err,
      };

      errorReport.push(error);
      callback();
    });
};

prompt.get(['startIndex', 'endIndex'], function(err, result) {
  const startIndex = parseInt(result.startIndex, 10);
  const endIndex = parseInt(result.endIndex, 10);
  console.log(`Start user index: ${startIndex}`);
  console.log(`End user index: ${endIndex}`);

  const userDirectories = fileLogic.getDirectories(rootProfileDataDirectory);
  async.forEachOfSeries(userDirectories.slice(startIndex, endIndex + 1), analysisTask, (err) => {
    if (err) {
      console.log(err.message);
      return;
    }

    const errorReportStr = JSON.stringify(errorReport, null, 2);
    fs.writeFileSync(`${outputDirectory}/error-report.json`, errorReportStr);
    console.log('Tasks executed successfully');
  });

});
