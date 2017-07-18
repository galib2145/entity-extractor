const path = require('path');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const async = require('async');

const twitterLogic = require('../analysis/twitter');
const dbLogic = Promise.promisifyAll(require('../db.js'));
const disqusLogic = require('../analysis/disqus');
const timeParser = require('../parsing/timeParser');
const mathLogic = require('../math');

const fileLogic = Promise.promisifyAll(require('../file.js'));

const config = require('../../config');

const getEntityMentionIntersection = (disqusMentions, twitterMentions) => {
  let intersection = [];
  disqusMentions.forEach((a) => {
    twitterMentions.forEach((b) => {
      if (a.entity === b.entity)
        intersection.push({
          entity: a.entity,
          disqusMentionCount: a.postCount,
          twitterMentionCount: b.postCount,
        });
    });
  });

  return intersection;
};

const compareTime = (t1, t2) => {
  if (t1.year !== t2.year) {
    return t1.year - t2.year;
  }

  if (t1.month !== t2.month) {
    return t1.month - t2.month;
  }

  return t1.day - t2.day;
};

const getTwitterTimeRange = (userId, callback) => {
  twitterLogic.getTwitterPostsAsync(userId)
    .then((twitterPosts) => {
      const postTimes = twitterPosts.map(post => timeParser.parseTimeString(post.time));
      const postTimesSorted = postTimes.sort(compareTime);
      const timeInfo = {
        start: postTimesSorted[0],
        end: postTimesSorted[postTimesSorted.length - 1],
      };

      callback(null, timeInfo);
    })
    .catch((err) => callback(err));
};

const getDisqusTimeRange = (userId, callback) => {
  disqusLogic.getDisqusCommentsAsync(userId)
    .then((disqusComments) => {
      const postTimes = disqusComments.map(post => timeParser.parseTimeString(post.time));
      const postTimesSorted = postTimes.sort(compareTime);
      const timeInfo = {
        start: postTimesSorted[0],
        end: postTimesSorted[postTimesSorted.length - 1],
      };

      callback(null, timeInfo);
    })
    .catch((err) => callback(err));
};

const addDays = (startDate, windowSize) => {
  let interDate = new Date(startDate.year, startDate.month - 1, startDate.day + 1);
  interDate.setDate(interDate.getDate() + windowSize);
  return {
    day: interDate.getDate() - 1,
    month: interDate.getMonth() + 1,
    year: interDate.getFullYear(),
  };
};

exports.addDays = addDays;

const getAnalysisTimeRange = (twitterUserId, disqusUserId, callback) => {
  const getTwitterTimeRangeAsync = Promise.promisify(getTwitterTimeRange);
  const getDisqusTimeRangeAsync = Promise.promisify(getDisqusTimeRange);

  Promise.all([
    getDisqusTimeRangeAsync(disqusUserId),
    getTwitterTimeRangeAsync(twitterUserId)
  ])
    .then((results) => {
      const twitterTimeRange = results[1];
      const disqusTimeRange = results[0];
      const timeRange = {
        startTime: compareTime(disqusTimeRange.start, twitterTimeRange.start) > 0 ?
          disqusTimeRange.start.start : twitterTimeRange.start,
        endTime: compareTime(disqusTimeRange.end, twitterTimeRange.end) > 0 ?
          twitterTimeRange.end : disqusTimeRange.end,
      };
      callback(null, timeRange);
    })
    .catch((err) => callback(err));
};

const calculateEntitySimilarityOnTimeRange = (twitterUserId, disqusUserId, startTime, endTime, callback) => {
  const startDate = new Date(startTime.year, startTime.month, startTime.day);
  const endDate = new Date(endTime.year, endTime.month, endTime.day);
  let disqusMentions = [];
  let twitterMentions = [];

  dbLogic.getDBAsync()
    .then((dbInstance) => {
      const mentionFindTasks = [
        dbLogic.getUserMentionsFromDbAsync(disqusUserId, 'disqus', startDate, endDate),
        dbLogic.getUserMentionsFromDbAsync(twitterUserId, 'twitter', startDate, endDate),
      ];

      return Promise.all(mentionFindTasks);
    })
    .then((taskResults) => {
      disqusMentions = taskResults[0];
      twitterMentions = taskResults[1];
      const postFindTasks = [
        dbLogic.getUserPostsFromDbAsync(disqusUserId, 'disqus', startDate, endDate),
        dbLogic.getUserPostsFromDbAsync(twitterUserId, 'twitter', startDate, endDate),
      ];

      return Promise.all(postFindTasks);
    })
    .then((taskResults) => {
      const numDisqusPosts = taskResults[0].length;
      if (numDisqusPosts === 0) {
        callback(null, 0);
        return;
      }

      const numTwitterPosts = taskResults[1].length;
      if (numTwitterPosts === 0) {
        callback(null, 0);
        return;
      }

      const entityIntersection = getEntityMentionIntersection(disqusMentions, twitterMentions);
      if (entityIntersection.length === 0) {
        callback(null, 0);
        return;
      }

      const disqusUEPList = entityIntersection.map((entry) => entry.disqusMentionCount / numDisqusPosts);
      const twitterUEPList = entityIntersection.map((entry) => entry.twitterMentionCount / numTwitterPosts);
      const sim = mathLogic.getDotProduct(disqusUEPList, twitterUEPList);
      callback(null, sim);
    })
    .catch(err => {
      callback(err);
    });

};

const makeEntitySimilarityTasksForTimeRange = (twitterUserId, disqusUserId, timeRange) => {
  const calculateEntitySimilarityOnTimeRangeAsync = Promise.promisify(calculateEntitySimilarityOnTimeRange);
  const startTime = timeRange.startTime;
  const endTime = timeRange.endTime;
  let windowStart = startTime;
  const timeBasedTasks = [];

  for (;;) {
    let windowEnd = addDays(windowStart, 7);
    let endFlag = false;
    if (compareTime(windowEnd, endTime) > 0) {
      windowEnd = endTime;
      endFlag = true;
    }

    timeBasedTasks.push(
      calculateEntitySimilarityOnTimeRangeAsync(twitterUserId, disqusUserId, windowStart, windowEnd));
    if (endFlag) {
      break;
    } else {
      windowStart = windowEnd;
    }
  }

  return timeBasedTasks;
};

const calculateEntitySimilarity = (twitterUserId, disqusUserId, callback) => {
  const getAnalysisTimeRangeAsync = Promise.promisify(getAnalysisTimeRange);
  const calculateEntitySimilarityOnTimeRangeAsync = Promise.promisify(calculateEntitySimilarityOnTimeRange);
  getAnalysisTimeRangeAsync(twitterUserId, disqusUserId)
    .then((timeRange) => {
      const timeBasedTasks = makeEntitySimilarityTasksForTimeRange(twitterUserId, disqusUserId, timeRange);
      return Promise.all(timeBasedTasks);
    })
    .then((results) => {
      const nonzeroes = results.filter(r => r > 0);
      const sum = nonzeroes.reduce((prevVal, elem) => prevVal + elem, 0);
      const avg = sum / results.length;
      console.log(`Task finished for user: ${disqusUserId}`);
      callback(null, avg);
    })
    .catch(err => {
      callback(err);
    });
};

exports.calculateEntitySimilarity = calculateEntitySimilarity;

const similarityMatchingTask = (userId, taskIndex, callback) => {

};

// this method would generate a top 10 ranking
const generateEntitySimilarityRankingWithDisqus = (userId, callback) => {
  const userIdList = (fileLogic.getUserIdList()).slice(0, 30);
  async.mapSeries(userIdList,
    (disqusUserId, callback) => {
      calculateEntitySimilarity(userId, disqusUserId, callback);
    }, (err, results) => {
      if (err) {
        callback(err);
        return;
      }

      const formattedResults = results.map((r, i) => {
        return {
          user: userIdList[i],
          sim: r,
        };
      });

      const res = formattedResults.sort((a, b) => b.sim - a.sim);
      callback(null, res);
    });

};

// calculateEntitySimilarity('100204_gregordotus', '100204_gregordotus', (err, res) => {
//   if (err) {
//     console.log(err);
//     return;
//   }

//   console.log(JSON.stringify(res, null, 2));
// });
