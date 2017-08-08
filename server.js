const express = require('express');
const app = express();

const Promise = require('bluebird');
const path = require('path');

const dataLogic = Promise.promisifyAll(require('./logic/analysis/generic.js'));
const fileLogic = Promise.promisifyAll(require('./logic/file'));
const queries = require('./queries');
const intersectionData = require('./data/intersection');

const temporalLogic = Promise.promisifyAll(require('./logic/experiment/temporal'));
const dbLogic = Promise.promisifyAll(require('./logic/db'));

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

app.get('/compare', function(req, res) {
  const twitterId = req.query.twitter;
  const disqusId = req.query.disqus;
  const interval = req.query.interval;
  let timeSlots = null;
  let analysisTimeRange = null;

  temporalLogic.getAnalysisTimeRangeAsync(twitterId, disqusId)
    .then((timeRange) => {
      analysisTimeRange = timeRange;
      timeSlots = temporalLogic.getTimeSlotsByDays(timeRange, interval);
      return Promise.all([
        dbLogic.getUserDataForTimeRangeAsync(twitterId, 'twitter', timeRange),
        dbLogic.getUserDataForTimeRangeAsync(disqusId, 'disqus', timeRange),
      ]);
    })
    .then((results) => {
      const twitterUserData = results[0];
      const disqusUserData = results[1];
      const data = temporalLogic.getNonZeroSlotsWithData(twitterUserData, disqusUserData, timeSlots);
      res.json({
        timeRange: analysisTimeRange,
        analysisData: data,
      });
    });
});
