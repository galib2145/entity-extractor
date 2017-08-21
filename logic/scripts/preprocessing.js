const async = require('async');
const path = require('path');
const Promise = require('bluebird');

const preprocessingLogic = Promise.promisifyAll(require('../preprocessing/generic'));
const fileLogic = require('../../logic/file');
const cosineLogic = Promise.promisifyAll(require('../../logic/experiment/cosine'));

const config = require('../../config');
const analysisDirectory = path.join(process.env.HOME, config.dir.alchemyAnalysis);

const preprocessingTask = (userDirectory, taskIndex, callback) => {
  const userId = userDirectory.split('/')[4];
  preprocessingLogic.preprocessUserEntityDataAsync(userId)
    .then(() => cosineLogic.saveWordListForUserProfileAsync(userId, 'disqus'))
    .then(() => cosineLogic.saveWordListForUserProfileAsync(userId, 'twitter'))
    .then(() => callback())
    .catch((err) => {
      console.log(err.message);
      callback();
    });
};

const userDirectories = fileLogic.getDirectories(analysisDirectory);
async.forEachOfSeries(userDirectories, preprocessingTask, (err) => {
  if (err) {
    console.log(err.message);
    return;
  }
  
  console.log('Tasks executed successfully');
});