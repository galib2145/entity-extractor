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
