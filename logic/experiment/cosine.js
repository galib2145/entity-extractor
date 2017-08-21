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
  const getWordListForUserProfileAsync = 
    Promise.promisify(makeWordListForUserProfile);
  const outDir = path.join(process.env.HOME, 'entity-analysis-2');
  const outPath = `${outDir}/${userId}/${media}-words`;
  getWordListForUserProfileAsync(userId, media)
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

const getCosineSimilarity = (ud, ut, callback) => {
  const getWordListForUserProfileAsync = 
    Promise.promisify(makeWordListForUserProfile);

  const entityDataTasks = [
    getWordListForUserProfileAsync(ud, 'disqus'),
    getWordListForUserProfileAsync(ut, 'twitter'),
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

const generateEntitySimilarityRankingWithTwitter = (userId, userIdList, windowSize, callback) => {
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

// getCosineSimilarity('1000_bigyahu', '1000_bigyahu', (err, r) => {console.log(r)});

// saveWordListForUserProfile('1000_bigyahu', 'twitter', () => {});