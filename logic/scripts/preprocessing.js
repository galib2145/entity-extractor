const async = require('async');
const path = require('path');

const preprocessingLogic = require('../preprocessing/generic');
const fileLogic = require('../../logic/file');

const config = require('../../config');
const analysisDirectory = path.join(process.env.HOME, config.dir.alchemyAnalysis);

const preprocessingTask = (userDirectory, taskIndex, callback) => {
  const userId = userDirectory.split('/')[4];
  preprocessingLogic.preprocessUserEntityData(userId, (err) => {
    if (err) {
      console.log(err.message);
      callback();
      return;
    }

    callback();
  })
};

const userDirectories = fileLogic.getDirectories(analysisDirectory);
async.forEachOfSeries(userDirectories, preprocessingTask, (err) => {
  if (err) {
    console.log(err.message);
    return;
  }
  
  console.log('Tasks executed successfully');
});