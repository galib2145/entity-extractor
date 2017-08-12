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
const utils = require('../../utils');
const bounds = require('binary-search-bounds');

const fileLogic = Promise.promisifyAll(require('../file.js'));

const config = require('../../config');

const makeUniqueEntityMap = (sortedEntityData) => {
  let currentDude = {};
  let uniqueMap = {};
  for (let i = 0; i < sortedEntityData.length; i++) {
    if (currentDude.entity === sortedEntityData[i].entity) {
      uniqueMap[currentDude.entity].count++;
    } else {
      uniqueMap[sortedEntityData[i].entity] = {
        count: 1,
        data: sortedEntityData[i]
      }

      currentDude = sortedEntityData[i];
    }
  }

  return uniqueMap;
};

const filterByDate = (data, s, e) => {
  const si = bounds.ge(data, { date: s }, (a, b) => a.date >= b.date ? 1 : -1);
  const ei = bounds.le(data, { date: e }, (a, b) => a.date > b.date ? 1 : -1);
  return data.slice(si, ei + 1);
};

const matchEntities = (e1Data, e2Data) => {
  if (e1Data.entity === e2Data.entity) {
    return true;
  }

  // if (e1Data.details && e2Data.details) {
  //   const subTypeMatches = utils.intersect(
  //     e1Data.details.subType,
  //     e2Data.details.subType
  //   );
  //   if (e1Data.type === e2Data.type && subTypeMatches.length > 0) {
  //     return true;
  //   }
  // }

  return false;
};

const getEntityMentionIntersection = (disqusMentions, twitterMentions) => {
  let intersection = [];
  for (let disqusEntry in disqusMentions) {
    for (let twitterEntry in twitterMentions) {
      const dEd = disqusMentions[disqusEntry].data;
      const tED = twitterMentions[twitterEntry].data;
      if (matchEntities(dEd, tED)) {
        intersection.push({
          entity: disqusEntry,
          disqusMentionCount: disqusMentions[disqusEntry].count,
          twitterMentionCount: twitterMentions[twitterEntry].count,
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
      const timeInfo = {
        start: postTimes[postTimes.length - 1],
        end: postTimes[0]
      };

      callback(null, timeInfo);
    })
    .catch((err) => callback(err));
};

const getDisqusTimeRange = (userId, callback) => {
  disqusLogic.getDisqusCommentsAsync(userId)
    .then((disqusComments) => {
      const postTimes = disqusComments.map(post => timeParser.parseTimeString(post.time));
      const timeInfo = {
        start: postTimes[postTimes.length - 1],
        end: postTimes[0]
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

exports.getAnalysisTimeRange = getAnalysisTimeRange;

const filterUserDataByTimeSlot = (userData, timeSlot) => {
  const startTime = timeSlot.windowStart;
  const endTime = timeSlot.windowEnd;
  const startDate = new Date(startTime.year, startTime.month, startTime.day);
  const endDate = new Date(endTime.year, endTime.month, endTime.day)
  const filteredMentions = userData.mentions.filter((m) =>
    m.date >= startDate && m.date <= endDate
  );

  const filteredPosts = userData.posts.filter((m) =>
    m.date >= startDate && m.date <= endDate
  );

  return {
    posts: filteredPosts,
    mentions: filteredMentions,
  };
};

exports.filterUserDataByTimeSlot = filterUserDataByTimeSlot;

const calculateEntitySimilarityOnTimeRange = (twitterData, disqusData, startTime, endTime) => {
  const startDate = new Date(startTime.year, startTime.month, startTime.day);
  const endDate = new Date(endTime.year, endTime.month, endTime.day);

  const disqusMentions = filterByDate(disqusData.mentions, startDate, endDate);
  const twitterMentions = filterByDate(twitterData.mentions, startDate, endDate);
  const twitterPosts = filterByDate(twitterData.posts, startDate, endDate);
  const disqusComments = filterByDate(disqusData.posts, startDate, endDate);
  
  disqusMentions.sort((a, b) => {
    return a.entity.localeCompare(b.entity);
  });
  twitterMentions.sort((a, b) => {
    return a.entity.localeCompare(b.entity);
  });

  if (twitterPosts.length === 0 ||
    disqusComments.length === 0 ||
    disqusMentions.length === 0 ||
    twitterMentions.length === 0) {
    return 0;
  }

  // let uniqueDisqusMentions = makeUniqueEntityMap(disqusMentions);
  // let uniqueTwitterMentions = makeUniqueEntityMap(twitterMentions);

  let uniqueDisqusMentions = {};
  disqusMentions.map((a) => {
    if (a.entity in uniqueDisqusMentions) uniqueDisqusMentions[a.entity].count++;
    else uniqueDisqusMentions[a.entity] = {
      count: 1,
      data: a,
    }
  });
  
  let uniqueTwitterMentions = {};
  twitterMentions.map(function(a) {
    if (a.entity in uniqueTwitterMentions) uniqueTwitterMentions[a.entity].count++;
    else uniqueTwitterMentions[a.entity] = {
      count: 1,
      data: a,
    }
  });

  const entityIntersection = getEntityMentionIntersection(uniqueDisqusMentions, uniqueTwitterMentions);
  if (entityIntersection.length === 0) {
    return 0;
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

const getNonZeroSlotsWithData = (twitterData, disqusData, timeSlots) => {
  const simList = timeSlots.map((timeSlot) => {
    return calculateEntitySimilarityOnTimeRange(
      twitterData,
      disqusData,
      timeSlot.windowStart,
      timeSlot.windowEnd
    );
  });

  const nonzeroes = simList.filter(r => r > 0);
  const sum = nonzeroes.reduce((prevVal, elem) => prevVal + elem, 0);
  const avg = sum / simList.length;

  const slotData = [];

  simList.forEach((s, i) => {
    if (s > 0) {
      const timeSlot = timeSlots[i];
      const twitterDataForSlot = filterUserDataByTimeSlot(twitterData, timeSlot);
      const disqusDataForSlot = filterUserDataByTimeSlot(disqusData, timeSlot);
      slotData.push({
        timeSlot,
        twitter: {
          postCount: twitterDataForSlot.posts.length,
          mentionCount: twitterDataForSlot.mentions.length,
        },
        disqus: {
          postCount: disqusDataForSlot.posts.length,
          mentions: disqusDataForSlot.mentions.length,
        },
        similarity: s,
      });
    }
  });

  return {
    sim: avg,
    slotData,
  };
};

exports.getNonZeroSlotsWithData = getNonZeroSlotsWithData;

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

exports.getTimeSlotsByDays = getTimeSlotsByDays;

const calculateEntitySimilarity = (twitterUserId, disqusUserId, windowSize, callback) => {
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
      const timeSlots = getTimeSlotsByDays(analysisTimeRange, windowSize);
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
      const avg = sum / simList.length;

      callback(null, avg);
    })
    .catch((err) => {
      callback(err);
      return;
    });

};

exports.calculateEntitySimilarity = calculateEntitySimilarity;

const generateEntitySimilarityRankingWithTwitter = (userId, userIdList, windowSize, callback) => {
  async.mapSeries(userIdList,
    (twitterUserId, callback) => {
      calculateEntitySimilarity(twitterUserId, userId, windowSize, callback);
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

exports.generateEntitySimilarityRankingWithTwitter = generateEntitySimilarityRankingWithTwitter;
