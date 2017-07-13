const fs = require('fs');
const path = require('path');

const config = require('../../config');
const twitterAnalysisLogic = require('../analysis/twitter');
const generic = require('./generic');

const formatUserTwitterEntityAnalysis = (userId, analysis) => {
  const twitterDataStoreFilePath = path.join(
    process.env.HOME,
    config.dir.alchemyAnalysis,
    `/${userId}`,
    config.dir.twitterDataStore
  );

  const posts = twitterAnalysisLogic.getTwitterPostsSync(userId);
  const entityList = generic.getProcessedEntityInfoList(analysis, 'twitter', posts);

  const userEntry = {
    username: userId,
    entityList,
  };

  return userEntry;
};

exports.formatUserTwitterEntityAnalysis = formatUserTwitterEntityAnalysis;
