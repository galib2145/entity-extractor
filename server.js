const express = require('express');
const app = express();

const Promise = require('bluebird');
const path = require('path');

const dataLogic = Promise.promisifyAll(require('./logic/analysis/generic.js'));
const fileLogic = Promise.promisifyAll(require('./logic/file'));
const queries = require('./queries');
const intersectionData = require('./data/intersection');

app.listen(3000, function() {
  console.log('listening on 3000')
});

app.all('*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

app.get('/user/:id/:media', function(req, res) {
  console.log(req.url);
  const media = req.params.media;
  const userId = req.params.id;

  dataLogic.getEntityDataForUser(userId, media, (err, resultSet) => {
    if (err) {
      res.send(err);
      return;
    }

    const topicListWithFrequency = resultSet.map((r) => {
      return {
        text: r.entity,
        size: r.count,
        type: r.type,
      }
    });

    res.json(topicListWithFrequency);
  });
});

app.get('/users', function(req, res) {
  console.log(req.url);
  const userDir = path.join(process.env.HOME, 'entity-analysis-2');
  const userDirList = fileLogic.getDirectories(userDir);
  const userList = userDirList.map((dir) => dir.split('/')[4]);
  res.json(userList);
});

app.get('/intersection', function(req, res) {
  res.json(intersectionData);
});
