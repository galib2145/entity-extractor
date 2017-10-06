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
const precompute = require('../analysis/precompute');

const genericLogic = Promise.promisifyAll(require('../analysis/generic'));

const getCosineSimilarityByStrArrays = (hashStr1, hashStr2, union) => {

  const featureSet = Object.keys(union);

  const vector1 = featureSet.map((feature) => {
    if (feature in hashStr1) {
      return 1;
    }

    return 0;
  });

  const vector2 = featureSet.map((feature) => {
    if (feature in hashStr2) {
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

  let union = {}
  let twitterWordHash = {};
  twitterPostsForTimeRange.forEach((p) => {
    p.wordList.forEach((w) => { 
      twitterWordHash[w] = 1;
      union[w] = 1;
    });
  });

  let disqusWordHash = {};
  disqusCommentsForTimeRange.forEach((p) => {
    p.wordList.forEach((w) => { 
      disqusWordHash[w] = 1;
      union[w] = 1;
    });
  });

  return getCosineSimilarityByStrArrays(disqusWordHash, twitterWordHash, union);
};

exports.getCosineSimilarityByTimeRange = getCosineSimilarityByTimeRange;

const calculateCosineSimilarity = (twitterId, disqusData, windowSize, callback) => {
  let analysisTimeRange = null;
  temporal.getAnalysisTimeRangeGivenDisqusAsync(twitterId, disqusData.timeRange)
    .then((timeRange) => {
      analysisTimeRange = timeRange;
      if (!analysisTimeRange) {
        return null;
      }

      const startDate = utils.getDateFromTime(timeRange.startTime);
      const endDate = utils.getDateFromTime(timeRange.endTime);
      return dbLogic.getUserPostsFromDbAsync(twitterId, 'twitter', startDate, endDate);
    })
    .then((twitterPosts) => {
      if (!analysisTimeRange) {
        callback(null, 0);
        return;
      }
      
      const disqusPosts = disqusData.posts;
      const timeSlots = temporal.getOverlappingTimeSlotsByDays(analysisTimeRange, windowSize);
      const simList = timeSlots.map((timeSlot) => {
        return getCosineSimilarityByTimeRange(
          twitterPosts,
          disqusPosts,
          timeSlot.windowStart,
          timeSlot.windowEnd
        );
      });

      const sum = simList.reduce((prevVal, elem) => prevVal + elem, 0);
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
  precompute.getRequiredDisqusData(userId, (err, disqusData) => {
    if (err) {
        console.log(err);
        callback(err);
        return;
    }
    async.mapSeries(userIdList, (twitterUserId, callback) => {
      calculateCosineSimilarity(twitterUserId, disqusData, windowSize, callback);
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

      callback(null, formattedResults);
    });

  })
  
};

exports.generateEntitySimilarityRankingWithTwitter = generateEntitySimilarityRankingWithTwitter;
