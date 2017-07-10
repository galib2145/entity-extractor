const path = require('path');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));

const twitterLogic = require('../analysis/twitter');
const disqusLogic = require('../analysis/disqus');
const timeParser = require('../parsing/timeParser');

const config = require('../../config');

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
  const twitterPosts = twitterLogic.getTwitterPosts(userId);
  const postTimes = twitterPosts.map(post => timeParser.parse(post.time));
  const postTimesSorted = postTimes.sort(compareTime);
  return postTimesSorted[0];
};

exports.getEarliestTwitterTime = getEarliestTwitterTime;

const getEarliestDisqusTime = (userId) => {
  const disqusComments = disqusLogic.getDisqusComments(userId);
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


const getEntitiesForUserForTimeRange = (userId, media, startTime, endTime) => {
  const baseDataStoreFilePath = path.join(
    process.env.HOME,
    config.dir.alchemyAnalysis,
    `/${userId}`
  );

  let mediaDataFilePath = baseDataStoreFilePath;
  if (media === 'twitter') {
    mediaDataFilePath = path.join(baseDataStoreFilePath, 'twitter-store');
  }

  if (media === 'disqus') {
    mediaDataFilePath = path.join(baseDataStoreFilePath, 'disqus-store');
  }

  const fileData = fs.readFileSync(mediaDataFilePath)
  const entityData = JSON.parse(fileData).entityList;
  const entityDataWithinTimeRange = entityData.map((data) => {
    const mentionTimes = data.mentionTimes;
    const mentionTimesInRange = mentionTimes.filter((time) => {
      if (compareTime(time, startTime) >= 0 && compareTime(endTime, time) >= 0) {
        return true;
      }

      return false;
    });

    if (mentionTimesInRange.length > 0) {
      return {
        entity: data.entity,
        postCount: mentionTimesInRange.length,
      };
    }

    return null;
  });

  return entityDataWithinTimeRange.filter((e) => e);
};

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


const data = getEntitiesForUserForTimeRange('1000_bigyahu', 'disqus', {
  "year": "2016",
  "month": "06",
  "day": 1,
  "hour": 22
}, {
  "year": "2016",
  "month": "06",
  "day": 1,
  "hour": 22
});

console.log(JSON.stringify(data, null, 2));
