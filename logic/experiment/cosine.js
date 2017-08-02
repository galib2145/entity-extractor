const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const _ = require('lodash');
const cosineSim = require('cosine-similarity');
const async = require('async');

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

const dataDirectory = path.join(process.env.HOME, 'entity-analysis-2');
const matchingResults = [];
const errors = [];

const processStart = new Date();
const userIdList = fileLogic.getUserIdList().slice(0, 100);
async.forEachOfSeries(userIdList, (userId, index, callback) => {
  const startTime = new Date();
  console.log(`\nStarting matching for : ${userId}`);
  generateEntitySimilarityRankingWithTwitter(userId, userIdList, (err, res) => {
    if (err) {
      console.log(err);
      errors.push({
        userId,
        err,
      });
      callback();
      return;
    }

    console.log(`Start time: ${startTime}`);
    console.log(`End time : ${new Date()}`);
    matchingResults.push({
      userId,
      res,
    });

    callback();
  });
}, (err) => {
  if (err) {
    console.log(err.message);
    return;
  }

  fs.writeFileSync(
    path.join(path.join(process.env.HOME, '/res/error-cosine')),
    JSON.stringify(errors, null, 2)
  );
  fs.writeFileSync(
    path.join(path.join(process.env.HOME, '/res/match-cosine')),
    JSON.stringify(matchingResults, null, 2)
  );

  console.log(`\nStart time: ${processStart}`);
  console.log(`End time : ${new Date()}`);
  console.log('Tasks executed successfully');
});
