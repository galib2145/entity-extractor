const fs = require('fs');
const path = require('path');

const config = require('../../config');
const disqusAnalysisLogic = require('../analysis/disqus');

const generic = require('./generic');

const formatUserDisqusEntityAnalysis = (userId, analysis) => {
  const disqusDataStoreFilePath = path.join(
    process.env.HOME,
    config.dir.alchemyAnalysis,
    `/${userId}`,
    config.dir.disqusDataStore
  );

  const comments = disqusAnalysisLogic.getDisqusCommentsSync(userId);
  const entityList = generic.getProcessedEntityInfoList(analysis, 'disqus', comments);

  const userEntry = {
    username: userId,
    entityList,
  };

  return userEntry;
};

exports.formatUserDisqusEntityAnalysis = formatUserDisqusEntityAnalysis;
