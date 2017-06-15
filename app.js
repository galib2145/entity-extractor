const fs = require('fs');
const request = require('request');
var querystring = require('querystring');
const async = require('async');
const mkdirp = require('mkdirp');

const logics = require('./logics');
const rootDirectory = '/home/saad-galib/media';
const outputDirectory = '/home/saad-galib/disqusAnalysis';
const userDirectories = logics.getDirectories(rootDirectory);

const disqusAnalysisTask = (userDirectory, taskIndex, callback) => {
  console.log(`\nExecuting task: ${taskIndex}`);
  console.log(`Directory: ${userDirectory}`);
  logics.getDisqusAnalysisForUser(userDirectory, (err, result) => {
    if (err) {
      callback(err);
      return;
    }

    const userId = userDirectory.split('/')[4];
    const filePath = `${outputDirectory}/${userId}/disqus.json`;
    mkdirp.sync(`${outputDirectory}/${userId}`);
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    callback();
  });
};


async.forEachOfSeries(userDirectories.slice(0, 2000), disqusAnalysisTask, (err) => {
  if (err) {
    console.log(err);
    return;
  }

  console.log('Tasks executed successfully');
});
