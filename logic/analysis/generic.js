const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const _ = require('lodash');
const cosineSim = require('cosine-similarity');

const config = require('../../config');

const disqusAnalysisLogic = require('./disqus');
const twitterAnalysisLogic = require('../analysis/twitter');
const fileLogic = require('../file');

const shouldUserBeAnalyzed = (userId) => {
  const twitterPosts = twitterAnalysisLogic.getTwitterPosts(userId);
  const disqusComments = disqusAnalysisLogic.getDisqusComments(userId);

  if (twitterPosts.length > 100 && disqusComments.length > 50) {
    return true;
  }

  return false;
};

exports.shouldUserBeAnalyzed = shouldUserBeAnalyzed;

const constructEntityAnalysisEntryList = (textSet, alchemyResponseList) => {
  const commentTextAnalysisList = [];

  for (let i = 0; i < textSet.length; i++) {
    const alchemyResponse = alchemyResponseList[i];
    if (alchemyResponse.entities) {
      const analysis = {
        text: textSet[i].text,
        startIndex: textSet[i].startIndex,
        endIndex: textSet[i].endIndex,
        startTime: textSet[i].startTime,
        endTime: textSet[i].endTime,
        entities: alchemyResponse.entities,
      }

      commentTextAnalysisList.push(analysis);
    }
  }

  return commentTextAnalysisList;
};

exports.constructEntityAnalysisEntryList = constructEntityAnalysisEntryList;

const getEntitiesForUser = (userId, media, callback) => {
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
  
  fs.readFileAsync(mediaDataFilePath)
    .then((fileData) => {
      const entityData = JSON.parse(fileData).entityList;
      const entities = entityData.map((data) => data.entity);
      const uniqueEntities = _.uniqBy(entities, (e) => e);
      callback(null, uniqueEntities);
    })
    .catch((err) => {
      callback(err);
    });
};

exports.getEntitiesForUser = getEntitiesForUser;

const getCosineSimilarity = (u1Entities, u2Entities) => {
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

const getEntitiesForUserAsync = Promise.promisify(getEntitiesForUser);
let entitySetOne = null;

getEntitiesForUserAsync('1000_bigyahu', 'twitter')
  .then((twitterEntities) => {
    entitySetOne = twitterEntities;
    return getEntitiesForUserAsync('1000_bigyahu', 'disqus');
  })
  .then((disqusEntities) => {
    const sim = getCosineSimilarity(entitySetOne, disqusEntities);
    console.log(sim);
  })
  .catch(err => console.log(err));