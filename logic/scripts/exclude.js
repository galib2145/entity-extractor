const path = require('path');
const async = require('async');
const Promise = require('bluebird');

const dbLogic = Promise.promisifyAll(require('../db.js'));
const fileLogic = Promise.promisifyAll(require('../file.js'));
const temporalLogic = Promise.promisifyAll(require('../experiment/temporal.js'));

const dataDirectory = path.join(process.env.HOME, 'entity-analysis-2');

dbLogic.initDB(() => {
  const userDirectories = fileLogic.getDirectories(dataDirectory);
  const validUsers = [];
  async.forEachOfSeries(userDirectories, (userDir, index, callback) => {
    const userId = userDir.split('/')[4];
    console.log(`\nStarting task of user : ${userId}`);
    temporalLogic.calculateEntitySimilarityAsync(userId, userId)
      .then((sim) => {
        if (sim === 0) {
          console.log(`Deleting directory of user : ${userId}`);
          fileLogic.deleteFolderRecursive(userDir);
        }

        callback();
      })
      .catch((err) => {
        console.log(err);
        callback();
      });
  }, (err) => {
    if (err) {
      console.log(err.message);
      return;
    }

    console.log('Tasks executed successfully');
  });
});
