const fs = require('fs');
const request = require('request');
var querystring = require('querystring');
const async = require('async');

const logics = require('./logics');
const rootDirectory = '/home/saad-galib/media'
const userDirectories = logics.getDirectories(rootDirectory);
let successNum = 0;
let successList = [];
let failNum = 0;
let failList = [];

const disqusAnalysisTask = (userDirectory, taskIndex, callback) => {
  console.log(`\nExecuting task: ${taskIndex}`);
  console.log(`Directory: ${userDirectory}`);
  logics.getDisqusAnalysisForUser(userDirectory, (err, result) => {
    if (err) {
      callback(err);
      return;
    }

    const user = userDirectory.split('/')[4];

    if (result.status) {
      successNum += 1;
      successList.push(user);
    } else {
      failNum += 1;
      failList.push({
        user,
        response: result.response,
      });
    }

    callback();
  });
};


async.forEachOfSeries(userDirectories.slice(2001, userDirectories.length), disqusAnalysisTask, (err) => {
  if (err) {
    console.log(err);
    return;
  }

  const successData = JSON.stringify({
    successList,
    num: successNum,
  }, null, 2);

  const failData = JSON.stringify({
    failList,
    num: failNum,
  }, null, 2);

  fs.writeFile('./success.json', successData);
  fs.writeFile('./fail.json', failData);
  console.log('Tasks executed successfully');
});
