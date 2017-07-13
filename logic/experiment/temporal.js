const path = require('path');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));

const twitterLogic = require('../analysis/twitter');
const dbLogic = Promise.promisifyAll(require('../db.js'));
const disqusLogic = require('../analysis/disqus');
const timeParser = require('../parsing/timeParser');

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

const getEarliestTwitterTime = (userId) => {
  const twitterPosts = twitterLogic.getTwitterPostsSync(userId);
  const postTimes = twitterPosts.map(post => timeParser.parse(post.time));
  const postTimesSorted = postTimes.sort(compareTime);
  return postTimesSorted[0];
};

exports.getEarliestTwitterTime = getEarliestTwitterTime;

const getEarliestDisqusTime = (userId) => {
  const disqusComments = disqusLogic.getDisqusCommentsSync(userId);
  const postTimes = disqusComments.map(post => timeParser.parseTimeString(post.time));
  const postTimesSorted = postTimes.sort(compareTime);
  return postTimesSorted[0];
};

exports.getEarliestDisqusTime = getEarliestDisqusTime;

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

const UEP = (numPostsForEntity / numTotalPost);

const compareProfiles = (twitterUserId, disqusUserId) => {
  const twitterStartTime = getEarliestTwitterTime(twitterUserId);
  const disqusStartTime = getEarliestDisqusTime(disqusUserId);
  const comparison = compareTime(twitterStartTime, disqusStartTime);
  let startTime = null;

  if (comparison > 0) {
    startTime = twitterStartTime;
  } else {
    startTime = disqusStartTime;
  }

  // start processing window size here
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

      // find dot product of two arrays here
    })
    .catch(err => {
      console.log(err);
    });

};

dbLogic.getDBAsync()
  .then((dbInstance) => {
    return dbLogic.getUserPostsFromDbAsync(dbInstance, '1000_bigyahu', 'disqus', new Date(2009, 1, 5), new Date(2016, 6, 6));
  })
  .then((disqusMentions) => {
    console.log(JSON.stringify(disqusMentions, null, 2));
  })
  .catch(err => {
    console.log(err);
  });
