const fs = require('fs');
const path = require('path');

const config = require('../../config');
const twitterAnalysisLogic = require('../analysis/twitter');
const timeParser = require('../parsing/timeParser');

const getExactEntityMentionTimes = (entityText, posts) => {
  const mentionedPosts = posts.filter((post) => post.text.includes(entityText));
  const mentionTimes = mentionedPosts.map((post) => post.time);
  return mentionTimes.filter((elem, index, self) => {
    return index == self.indexOf(elem);
  });
}

const getProcessedEntityInfoList = (analysisList, posts) => {
  const entities = {};
  for (let i = 0; i < analysisList.length; i += 1) {
    const searchStartIndex = analysisList[i].startIndex;
    const searchEndIndex = analysisList[i].endIndex;
    const commentsToSearch = posts.slice(searchStartIndex, searchEndIndex + 1);
    const entityInfoList = analysisList[i].entities;

    for (let j = 0; j < entityInfoList.length; j += 1) {
      const entityInfo = entityInfoList[j];
      const entityText = entityInfo.text.replace(/$|\./gi, '');
      const mentionTimesStrings = getExactEntityMentionTimes(entityText, commentsToSearch);
      const mentionTimes = mentionTimesStrings.map((timeStr) => timeParser.parseTimeString(timeStr));

      if (entities[entityText]) {
        entities[entityText].count += mentionTimes.length;
        entities[entityText].mentionTimes = entities[entityText].mentionTimes.concat(mentionTimes);
      } else {
        entities[entityText] = {
          count: mentionTimes.length,
          mentionTimes,
        };
      }
    }
  }

  const array = Object.keys(entities).map((key) => {
    const entry = entities[key];
    return {
      entity: key,
      count: entry.count,
      mentionTimes: entry.mentionTimes,
    };
  });

  return array;
};

const formatUserTwitterEntityAnalysis = (userId, analysis) => {
  const twitterDataStoreFilePath = path.join(
    process.env.HOME, 
    config.dir.alchemyAnalysis,
    `/${userId}`,
    config.dir.twitterDataStore
  );

  const posts = twitterAnalysisLogic.getTwitterPosts(userId);
  const entityList = getProcessedEntityInfoList(analysis, posts);

  const userEntry = {
    username: userId,
    entityList,
  };

  return userEntry;
};

exports.formatUserTwitterEntityAnalysis = formatUserTwitterEntityAnalysis;
