const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const _ = require('lodash');
const cosineSim = require('cosine-similarity');
const async = require('async');
sw = require('stopword');

const disqusLogic = Promise.promisifyAll(require('../analysis/disqus'));
const twitterLogic = Promise.promisifyAll(require('../analysis/twitter'));

const config = require('../../config');
const fileLogic = require('../file');

const genericLogic = Promise.promisifyAll(require('../analysis/generic'));

const getCosineSimilarityByEntities = (u1Entities, u2Entities) => {
  const entityUnion = u1Entities.concat(u2Entities);
  const featureSet = _.uniqBy(entityUnion, (e) => e);

  const u1Vector = featureSet.map((feature) => {
    if (u1Entities.includes(feature)) {
      return 1;
    }

    return 0;
  });

  const u2Vector = featureSet.map((feature) => {
    if (u2Entities.includes(feature)) {
      return 1;
    }

    return 0;
  });

  return cosineSim(u1Vector, u2Vector);
};

const getCosineSimilarity = (ud, ut, callback) => {
  const entityDataTasks = [
    genericLogic.getEntitiesForUserAsync(ud, 'disqus'),
    genericLogic.getEntitiesForUserAsync(ut, 'twitter'),
  ];

  Promise.all(entityDataTasks)
    .then((results) => {
      const dE = results[0];
      const tE = results[1];
      const sim = getCosineSimilarityByEntities(dE, tE);
      callback(null, sim);
    })
    .catch((err) => {
      callback(err);
    });
};

exports.getCosineSimilarity = getCosineSimilarity;

const getWordListForUserProfile = (userId, media, callback) => {
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

exports.getWordListForUserProfile = getWordListForUserProfile;

const generateEntitySimilarityRankingWithTwitter = (userId, userIdList, callback) => {
  async.mapSeries(userIdList,
    (twitterUserId, callback) => {
      getCosineSimilarity(userId, twitterUserId, callback);
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

getWordListForUserProfile('1000_bigyahu', 'disqus', (err, r) => {
  console.log(r.slice(0, 50));
});
