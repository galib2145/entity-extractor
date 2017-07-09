const fs = require('fs');
const path = require('path');

const config = require('../../config');
const disqusAnalysisLogic = require('../analysis/disqus');
const timeParser = require('../parsing/timeParser');

const getExactEntityMentionTimes = (entityText, comments) => {
  const mentionedPosts = comments.filter((comment) => comment.post.includes(entityText));
  const mentionTimes = mentionedPosts.map((post) => post.time);
  return mentionTimes.filter((elem, index, self) => {
    return index == self.indexOf(elem);
  });
}

const getProcessedEntityInfoList = (analysisList, comments) => {
  const entities = {};
  for (let i = 0; i < analysisList.length; i += 1) {
    const searchStartIndex = analysisList[i].startIndex;
    const searchEndIndex = analysisList[i].endIndex;
    const commentsToSearch = comments.slice(searchStartIndex, searchEndIndex + 1);
    const entityInfoList = analysisList[i].entities;

    for (let j = 0; j < entityInfoList.length; j += 1) {
      const entityInfo = entityInfoList[j];
      const entityText = entityInfo.text.toLowerCase();
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

const formatUserDisqusEntityAnalysis = (userId, analysis) => {
  const disqusDataStoreFilePath = path.join(
    process.env.HOME,
    config.dir.alchemyAnalysis,
    `/${userId}`,
    config.dir.disqusDataStore
  );

  const comments = disqusAnalysisLogic.getDisqusComments(userId);
  const entityList = getProcessedEntityInfoList(analysis, comments);

  const userEntry = {
    username: userId,
    entityList,
  };

  return userEntry;
};

exports.formatUserDisqusEntityAnalysis = formatUserDisqusEntityAnalysis;

// const data = fs.readFileSync('/home/saad/entity-analysis/1000_bigyahu/disqus.json');
// const analysis = JSON.parse(data).analysis;
// formatUserDisqusEntityAnalysis('1000_bigyahu', analysis);
