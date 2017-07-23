const path = require('path');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const async = require('async');
const _ = require('lodash');

const twitterLogic = require('../analysis/twitter');
const dbLogic = Promise.promisifyAll(require('../db.js'));
const disqusLogic = require('../analysis/disqus');
const timeParser = require('../parsing/timeParser');
const mathLogic = require('../math');

const fileLogic = Promise.promisifyAll(require('../file.js'));

const config = require('../../config');

const getEntityMentionIntersection = (disqusMentions, twitterMentions) => {
  let intersection = [];

  for (let disqusEntry in disqusMentions) {
    for (let twitterEntry in twitterMentions) {
      if (disqusEntry.includes(twitterEntry) || twitterEntry.includes(disqusEntry)) {
        intersection.push({
          entity: disqusEntry,
          disqusMentionCount: disqusMentions[disqusEntry],
          twitterMentionCount: twitterMentions[twitterEntry],
        });
      }
    }
  }

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
          disqusTimeRange.start : twitterTimeRange.start,
        endTime: compareTime(disqusTimeRange.end, twitterTimeRange.end) > 0 ?
          twitterTimeRange.end : disqusTimeRange.end,
      };
      callback(null, timeRange);
    })
    .catch((err) => callback(err));
};

const calculateEntitySimilarityOnTimeRange = (twitterData, disqusData, startTime, endTime) => {
  const startDate = new Date(startTime.year, startTime.month, startTime.day);
  const endDate = new Date(endTime.year, endTime.month, endTime.day);

  const disqusMentions = disqusData.mentions.filter((m) =>
    m.date >= startDate && m.date <= endDate
  );

  const twitterMentions = twitterData.mentions.filter((m) =>
    m.date >= startDate && m.date <= endDate
  );

  const twitterPosts = twitterData.posts.filter((m) =>
    m.date >= startDate && m.date <= endDate
  );

  const disqusComments = disqusData.posts.filter((m) =>
    m.date >= startDate && m.date <= endDate
  );

  if (twitterPosts.length === 0 ||
    disqusComments.length === 0 ||
    disqusMentions.length === 0 ||
    twitterMentions.length === 0) {
    return 0;
  }

  const uniqueDisqusMentions = [];
  disqusMentions.map(function(a) {
    if (a.entity in uniqueDisqusMentions) uniqueDisqusMentions[a.entity]++;
    else uniqueDisqusMentions[a.entity] = 1;
  });

  const uniqueTwitterMentions = [];
  twitterMentions.map(function(a) {
    if (a.entity in uniqueTwitterMentions) uniqueTwitterMentions[a.entity]++;
    else uniqueTwitterMentions[a.entity] = 1;
  });

  const entityIntersection = getEntityMentionIntersection(uniqueDisqusMentions, uniqueTwitterMentions);
  if (entityIntersection.length === 0) {
    return 0;
  }

  if (startTime.year === 2016 && startTime.day === 18 && startTime.month === 4) {
    console.log(entityIntersection);
  }

  const disqusUEPList = entityIntersection.map((entry) =>
    entry.disqusMentionCount / disqusComments.length
  );

  const twitterUEPList = entityIntersection.map((entry) =>
    entry.twitterMentionCount / twitterPosts.length
  );

  const similarity = mathLogic.getDotProduct(disqusUEPList, twitterUEPList);
  return similarity;
};

const getTimeSlotsByDays = (timeRange, numDays) => {
  const startTime = timeRange.startTime;
  const endTime = timeRange.endTime;
  let windowStart = startTime;
  const timeSlots = [];

  for (;;) {
    let windowEnd = addDays(windowStart, numDays);
    let endFlag = false;
    if (compareTime(windowEnd, endTime) > 0) {
      windowEnd = endTime;
      endFlag = true;
    }

    timeSlots.push({
      windowStart,
      windowEnd,
    });
    if (endFlag) {
      break;
    } else {
      windowStart = windowEnd;
    }
  }

  return timeSlots;
};

const calculateEntitySimilarity = (twitterUserId, disqusUserId, callback) => {
  const getAnalysisTimeRangeAsync = Promise.promisify(getAnalysisTimeRange);
  let analysisTimeRange = null;
  getAnalysisTimeRangeAsync(twitterUserId, disqusUserId)
    .then((timeRange) => {
      analysisTimeRange = timeRange;
      return Promise.all([
        dbLogic.getUserDataForTimeRangeAsync(twitterUserId, 'twitter', timeRange),
        dbLogic.getUserDataForTimeRangeAsync(disqusUserId, 'disqus', timeRange),
      ]);
    })
    .then((results) => {
      const twitterUserData = results[0];
      const disqusUserData = results[1];
      const timeSlots = getTimeSlotsByDays(analysisTimeRange, 7);
      const simList = timeSlots.map((timeSlot) => {
        return calculateEntitySimilarityOnTimeRange(
          twitterUserData,
          disqusUserData,
          timeSlot.windowStart,
          timeSlot.windowEnd
        );
      });

      const nonzeroes = simList.filter(r => r > 0);
      const sum = nonzeroes.reduce((prevVal, elem) => prevVal + elem, 0);
      const avg = sum / results.length;

      callback(null, avg);
    })
    .catch((err) => {
      callback(err);
    });

};

exports.calculateEntitySimilarity = calculateEntitySimilarity;


const startTime = new Date();
calculateEntitySimilarity('1000_bigyahu', '1000_bigyahu', (err, r) => {
  if (err) {
    console.log(err);
    return;
  }

  console.log(`Start time: ${startTime}`);
  console.log(`End time : ${new Date()}`);
  console.log(JSON.stringify(r, null, 2));
});
