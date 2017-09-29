const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const _ = require('lodash');
const cosineSim = require('cosine-similarity');
const async = require('async');
const temporal = require('./temporal');
const utils = require('../../utils');
const sw = require('stopword');

const dbLogic = Promise.promisifyAll(require('../db.js'));

const disqusLogic = Promise.promisifyAll(require('../analysis/disqus'));
const twitterLogic = Promise.promisifyAll(require('../analysis/twitter'));

const config = require('../../config');
const fileLogic = require('../file');

const genericLogic = Promise.promisifyAll(require('../analysis/generic'));

const getCosineSimilarityByStrArrays = (strArray1, strArray2) => {
  const union = strArray1.concat(strArray2);
  const featureSet = _.uniqBy(union, (e) => e);

  const vector1 = featureSet.map((feature) => {
    if (strArray1.includes(feature)) {
      return 1;
    }

    return 0;
  });

  const vector2 = featureSet.map((feature) => {
    if (strArray2.includes(feature)) {
      return 1;
    }

    return 0;
  });

  return cosineSim(vector1, vector2);
};

const makeWordListForUserProfile = (userId, media, callback) => {
  let dataFunc = null;
  let postTextArray = null;
  if (media === 'twitter') {
    dataFunc = twitterLogic.getTwitterPostsAsync;
  } else {
    dataFunc = disqusLogic.getDisqusCommentsAsync;
  }

  dataFunc(userId)
    .then((posts) => {
      if (media === 'twitter') {
        postTextArray = posts.map(p => p.text);
      } else {
        postTextArray = posts.map(p => p.post);
      }

      const wordList = [].concat.apply(
          [], postTextArray.map((pa) => pa.split(' ')));

      const uniqueWordList = _.uniqBy(wordList, e => e);
      const fwl = sw.removeStopwords(uniqueWordList);
      callback(null, fwl);
    })
    .catch((err) => {
      callback(err);
    });
};

exports.makeWordListForUserProfile = makeWordListForUserProfile;

const saveWordListForUserProfile = (userId, media, callback) => {
  const makeWordListForUserProfileAsync = 
    Promise.promisify(makeWordListForUserProfile);
  const outDir = path.join(process.env.HOME, 'entity-analysis-2');
  const outPath = `${outDir}/${userId}/${media}-words`;
  makeWordListForUserProfileAsync(userId, media)
    .then((wordList) => {
      const str = JSON.stringify(wordList, null, 2);
      return fs.writeFileAsync(outPath, str);
    })
    .then(() => callback())
    .catch((err) => {
      callback(err);
    });
};

exports.saveWordListForUserProfile = saveWordListForUserProfile;

const getWordListForUserProfile = (userId, media, callback) => {
  const outDir = path.join(process.env.HOME, 'entity-analysis-2');
  const wordFilePath = `${outDir}/${userId}/${media}-words`;
  fs.readFileAsync(wordFilePath)
    .then((str) => {
      const wordList = JSON.parse(str);
      callback(null, wordList);
    })
    .catch((err) => {
      callback(err);
    });
};

const getCosineSimilarityByTimeRange = (twitterPosts, disqusComments, startTime, endTime) => {
  const startDate = new Date(startTime.year, startTime.month, startTime.day);
  const endDate = new Date(endTime.year, endTime.month, endTime.day);

  const twitterPostsForTimeRange = temporal.filterByDate(twitterPosts, startDate, endDate);
  const disqusCommentsForTimeRange = temporal.filterByDate(disqusComments, startDate, endDate);

  let twitterWordList = [];
  twitterPostsForTimeRange.forEach((p) => {
    twitterWordList = twitterWordList.concat(p.wordList);
  });

  let disqusWordList = [];
  disqusCommentsForTimeRange.forEach((p) => {
    disqusWordList = disqusWordList.concat(p.wordList);
  });

  return getCosineSimilarityByStrArrays(disqusWordList, twitterWordList);
};

exports.getCosineSimilarityByTimeRange = getCosineSimilarityByTimeRange;

const calculateCosineSimilarity = (twitterUserId, disqusUserId, windowSize, callback) => {
  const getAnalysisTimeRangeAsync = Promise.promisify(temporal.getAnalysisTimeRange);
  let analysisTimeRange = null;
  temporal.getAnalysisTimeRangeAsync(twitterUserId, disqusUserId)
    .then((timeRange) => {
      analysisTimeRange = timeRange;
      const startDate = utils.getDateFromTime(timeRange.startTime);
      const endDate = utils.getDateFromTime(timeRange.endTime);
      return Promise.all([
        dbLogic.getUserPostsFromDbAsync(twitterUserId, 'twitter', startDate, endDate),
        dbLogic.getUserPostsFromDbAsync(disqusUserId, 'disqus', startDate, endDate),
      ]);
    })
    .then((results) => {
      const twitterPosts = results[0];
      const disqusPosts = results[1];
      const timeSlots = temporal.getOverlappingTimeSlotsByDays(analysisTimeRange, windowSize);
      const simList = timeSlots.map((timeSlot) => {
        return getCosineSimilarityByTimeRange(
          twitterPosts,
          disqusPosts,
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

exports.calculateCosineSimilarity = calculateCosineSimilarity;

const generateEntitySimilarityRankingWithTwitter = (userId, userIdList, windowSize, callback) => {
  async.mapSeries(userIdList,
    (twitterUserId, callback) => {
      calculateCosineSimilarity(twitterUserId, userId, windowSize, callback);
    }, (err, results) => {
      if (err) {
        console.log(err);
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
