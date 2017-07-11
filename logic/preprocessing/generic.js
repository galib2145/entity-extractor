const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const async = require('async');

const twitterPreprocessingLogic = require('./twitter');
const disqusPreprocessingLogic = require('./disqus');

const config = require('../../config');
const fileLogic = require('../../logic/file');
const rootProfileDataDirectory = path.join(process.env.HOME, config.dir.profileData);

const preprocessUserEntityData = (userId, callback) => {
  console.log(`\nExecuting preprocessing for user: ${userId}`);
  const baseAnalysisDirectory = path.join(process.env.HOME, 'entity-analysis-2', userId);
  const twitterFilePath = `${baseAnalysisDirectory}/twitter.json`;
  const disqusFilePath = `${baseAnalysisDirectory}/disqus.json`;
  const fileReadTasks = [
    fs.readFileAsync(twitterFilePath),
    fs.readFileAsync(disqusFilePath),
  ];

  Promise.all(fileReadTasks)
    .then((results) => {
      const twitterAnalysis = JSON.parse(results[0]).analysis;
      const disqusAnalysis = JSON.parse(results[1]).analysis;
      const processedTwitter = twitterPreprocessingLogic.formatUserTwitterEntityAnalysis(userId, twitterAnalysis);
      const processedDisqus = disqusPreprocessingLogic.formatUserDisqusEntityAnalysis(userId, disqusAnalysis);
      const fileWriteTasks = [
        fs.writeFileAsync(`${baseAnalysisDirectory}/twitter-store`, JSON.stringify(processedTwitter, null, 2)),
        fs.writeFileAsync(`${baseAnalysisDirectory}/disqus-store`, JSON.stringify(processedDisqus, null, 2)),
      ];

      return Promise.all(fileWriteTasks);
    })
    .then(() => callback())
    .catch((err) => callback(err));

};

exports.preprocessUserEntityData = preprocessUserEntityData;

const preprocessingTask = (userDirectory, taskIndex, callback) => {
  const userId = userDirectory.split('/')[4];
  preprocessUserEntityData(userId, (err) => {
    if (err) {
      console.log(err.message);
      callback();
      return;
    }

    callback();
  })
};

const userDirectories = fileLogic.getDirectories(rootProfileDataDirectory);
async.forEachOfSeries(userDirectories, preprocessingTask, (err) => {
  if (err) {
    console.log(err.message);
    return;
  }

  const errorReportStr = JSON.stringify(errorReport, null, 2);
  fs.writeFileSync(`${outputDirectory}/error-report.json`, errorReportStr);
  console.log('Tasks executed successfully');
});

// preprocessUserEntityData('1000_bigyahu', (err) => {
//   if (err) {
//     console.log(err);
//     return;
//   }

//   console.log('done!');
// })
