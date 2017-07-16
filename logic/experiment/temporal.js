const path = require('path');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));

const twitterLogic = require('../analysis/twitter');
const dbLogic = Promise.promisifyAll(require('../db.js'));
const disqusLogic = require('../analysis/disqus');
const timeParser = require('../parsing/timeParser');
const mathLogic = require('../math');

const config = require('../../config');

const getEntityMentionIntersection = (disqusMentions, twitterMentions) => {
  let intersection = [];
  disqusMentions.forEach(arr1, (a) => {
    twitterMentions.forEach(arr2, (b) => {
      if (a.entity === b.entity)
        intersection.push({
          entity: a.entity,
          disqusMentionCount: a.count,
          twitterMentionCount: b.count,
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

const addDay = (startDate, windowSize) => {
  let interDate = new Date(startDate.year, startDate.month - 1, startDate.day + 1);
  interDate.setDate(interDate.getDate() + windowSize);
  return {
    day: interDate.getDate() - 1,
    month: interDate.getMonth() + 1,
    year: interDate.getFullYear(),
  };
};

exports.addDay = addDay;

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
          twitterTimeRange.start : disqusTimeRange.start,
        endTime: compareTime(disqusTimeRange.end, twitterTimeRange.end) > 0 ?
          disqusTimeRange.end : twitterTimeRange.end,
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
        dbLogic.getUserMentionsFromDbAsync(dbInstance, disqusUserId, 'disqus', startTime, endTime),
        dbLogic.getUserMentionsFromDbAsync(dbInstance, twitterUserId, 'twitter', startTime, endTime)
      ];

      return Promise.all(mentionFindTasks);
    })
    .then((taskResults) => {
      disqusMentions = taskResults[0];
      twitterMentions = taskResults[1];
      const postFindTasks = [
        dbLogic.getPostsFromDbAsync(dbInstance, disqusUserId, 'disqus', startTime, endTime),
        dbLogic.getPostsFromDbAsync(dbInstance, twitterUserId, 'twitter', startTime, endTime)
      ];

      return Promise.all(postFindTasks);
    })
    .then((taskResults) => {
      const numDisqusPosts = taskResults[0].length;
      const numTwitterPosts = taskResults[1].length;
      const entityIntersection = getEntityMentionIntersection(disqusMentions, twitterMentions);
      const disqusUEPList = entityIntersection.map((entry) => entry.disqusMentionCount / numDisqusPosts);
      const twitterUEPList = entityIntersection.map((entry) => entry.twitterMentionCount / numTwitterPosts);
      const sim = mathLogic.getDotProduct(disqusUEPList, twitterUEPList);
      callback(null, sim);
    })
    .catch(err => {
      callback(err);
    });

};

// dbLogic.getUserPostsFromDbAsync('1000_bigyahu', 'disqus', new Date(2009, 1, 5), new Date(2016, 6, 6))
//   .then((disqusMentions) => {
//     console.log(JSON.stringify(disqusMentions, null, 2));
//   })
//   .catch(err => {
//     console.log(err);
//   });

getAnalysisTimeRange('1000_bigyahu', '1000_bigyahu', (err, res) => {
  if (err) {
    console.log(err);
    return;
  }

  console.log(JSON.stringify(res, null, 2));
});
