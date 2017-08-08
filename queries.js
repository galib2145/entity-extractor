const Promise = require('bluebird');

const fs = require('fs');
const path = require('path');

const fileLogic = require('./logic/file');
const config = require('./config');
const dataDirectory = path.join(process.env.HOME, 'entity-analysis-2');

const getDisqusTopicData = (userId) => {
  const disqusDataStoreFilePath = path.join(
    process.env.HOME,
    config.dir.alchemyAnalysis,
    `/${userId}`,
    'disqus-store'
  );

  const fileContent = fs.readFileSync(disqusDataStoreFilePath).toString();
  return (JSON.parse(fileContent)).entityList;
};

const getTwitterTopicData = (userId) => {
  const disqusDataStoreFilePath = path.join(
    process.env.HOME,
    config.dir.alchemyAnalysis,
    `/${userId}`,
    'twitter-store'
  );

  const fileContent = fs.readFileSync(disqusDataStoreFilePath).toString();
  return (JSON.parse(fileContent)).entityList;
};

const getRecurrentTopicPercentage = (userId) => {
  const disqusTopicData = getDisqusTopicData(userId);
  const numtotalTopics = disqusTopicData.length;
  if (numtotalTopics === 0) {
    return 0;
  }

  const numRecurrentTopics = (disqusTopicData.filter((topic) => topic.count > 1)).length;
  return (numRecurrentTopics / numtotalTopics) * 100;
};

const userHasTopics = (userId) => {
  const disqusTopicData = getDisqusTopicData(userId);
  const numtotalTopics = disqusTopicData.length;
  if (numtotalTopics === 0) {
    return false;
  }

  return true;
}

const getRecurrentTopicUserPercentage = () => {
  const recurrentPercentages = userDirectories.map((userDirectory, index) => {
    const userId = userDirectory.split('/')[4];
    const recurrentPercentage = getRecurrentTopicPercentage(userId);
    return recurrentPercentage;
  });

  const numvalidDirectories = (userDirectories.filter((userDirectory) => {
    const userId = userDirectory.split('/')[4];
    return userHasTopics(userId);
  })).length;

  const validRecurrentPercentages = recurrentPercentages.filter((value) => value > 0);
  return (validRecurrentPercentages.length / numvalidDirectories) * 100;
}

const getDisqusTopicIntersectionPercentage = (userId) => {
  try {
    const disqusTopicData = getDisqusTopicData(userId);
    const twitterTopicData = getTwitterTopicData(userId);
    const matchedEntities = [];

    const mapped = disqusTopicData.map((disqusEntry) => {
      const match = twitterTopicData.find((twitterEntry) => twitterEntry.entity === disqusEntry.entity);
      if (match) {
        matchedEntities.push(disqusEntry);
        return 1;
      }

      return 0;
    });

    const intrNum = mapped.reduce((prevVal, elem) => {
      return prevVal + elem;
    }, 0);

    const matchPercent = (intrNum / disqusTopicData.length) * 100;
    console.log(`Match percent for user: ${userId}: ${matchPercent}`);
    return matchPercent;
  } catch (err) {
    throw err;
  }
};

const getDisqusTopicIntersectionData = () => {
  const intersectionArray = [];
  const userDirectories = fileLogic.getDirectories(dataDirectory);
  userDirectories.forEach((dir) => {
    const userId = dir.split('/')[4];
    const percentage = getDisqusTopicIntersectionPercentage(userId);
    intersectionArray.push({
      userId,
      percentage,
    });
  });

  const percentPlot = [];
  for (let i = 1; i <= 100; i++) {
    const numResults = (intersectionArray.filter((e) =>
      e.percentage > i)).length;
    percentPlot.push({
      percent: i,
      num: numResults,
    });
  }

  return percentPlot;
};

exports.getDisqusTopicIntersectionData = getDisqusTopicIntersectionData;
