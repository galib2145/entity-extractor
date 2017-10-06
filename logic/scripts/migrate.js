const async = require('async');
const path = require('path');

const dbLogic = require('../db');
const fileLogic = require('../file');
const dataDirectory = path.join(process.env.HOME, 'entity-analysis-2');

const userDirectories = fileLogic.getDirectories(dataDirectory);
async.forEachOfSeries(userDirectories, (userDir, index, callback) => {
  const splitted = userDir.split('/');
  const userId = splitted[splitted.length - 1];
  console.log(`\nSaving user data for : ${userId}`);
  dbLogic.saveUserDataInDB(userId, callback);
}, (err) => {
  if (err) {
    console.log(err.message);
    return;
  }

  console.log('Tasks executed successfully');
});
