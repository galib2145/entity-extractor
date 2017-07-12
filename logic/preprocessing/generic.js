const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const async = require('async');

const twitterPreprocessingLogic = require('./twitter');
const disqusPreprocessingLogic = require('./disqus');

const config = require('../../config');
const fileLogic = require('../../logic/file');
const timeParser = require('../parsing/timeParser');
const analysisDirectory = path.join(process.env.HOME, config.dir.alchemyAnalysis);

const getExactEntityMentionTimes = (entityText, media, comments) => {
  let mentionedPosts = null;
  if (media === 'disqus') {
    mentionedPosts = comments.filter((comment) => comment.post.toLowerCase().includes(entityText));
  } else {
    mentionedPosts = comments.filter((comment) => comment.text.toLowerCase().includes(entityText));
  }
  const mentionTimes = mentionedPosts.map((post) => post.time);
  return mentionTimes.filter((elem, index, self) => {
    return index == self.indexOf(elem);
  });
};

const getProcessedEntityInfoList = (analysisList, media, comments) => {
  const entities = {};
  for (let i = 0; i < analysisList.length; i += 1) {
    const searchStartIndex = analysisList[i].startIndex;
    const searchEndIndex = analysisList[i].endIndex;
    const commentsToSearch = comments.slice(searchStartIndex, searchEndIndex + 1);
    const entityInfoList = analysisList[i].entities;

    for (let j = 0; j < entityInfoList.length; j += 1) {
      const entityInfo = entityInfoList[j];
      const entityText = entityInfo.text.toLowerCase();
      const mentionTimesStrings = getExactEntityMentionTimes(entityText, media, commentsToSearch);
      const mentionTimes = mentionTimesStrings.map((timeStr) => timeParser.parseTimeString(timeStr));
      const mentionSentiments = mentionTimes.map(() => entityInfo.sentiment);
      const mentionEmotions = mentionTimes.map(() => entityInfo.emotions); 

      if (entities[entityText]) {
        entities[entityText].count += mentionTimes.length;
        entities[entityText].mentionTimes = entities[entityText].mentionTimes.concat(mentionTimes);
        entities[entityText].mentionSentiments = entities[entityText].mentionSentiments.concat(mentionSentiments);
        entities[entityText].mentionEmotions = entities[entityText].mentionEmotions.concat(mentionEmotions);
      } else {
        entities[entityText] = {
          count: mentionTimes.length,
          mentionTimes,
          mentionSentiments,
          mentionEmotions,
        };
      }
    }
  };

  const array = Object.keys(entities).map((key) => {
    const entry = entities[key];
    return {
      entity: key,
      count: entry.count,
      mentionTimes: entry.mentionTimes,
      sentiments: entry.mentionSentiments,
      emotions: entry.mentionEmotions,
    };
  });

  return array;
};

exports.getProcessedEntityInfoList = getProcessedEntityInfoList;

const preprocessUserEntityData = (userId, callback) => {
  console.log(`\nExecuting preprocessing for user: ${userId}`);
  const baseAnalysisDirectory = path.join(process.env.HOME, 'entity-analysis-2', userId);
  const twitterFilePath = `${baseAnalysisDirectory}/twitter.json`;
  const disqusFilePath = `${baseAnalysisDirectory}/disqus.json`;
  const fileReadTasks = [
    fs.readFileAsync(twitterFilePath),
    fs.readFileAsync(disqusFilePath),
  ];

  Promise.all(fileReadTasks)
    .then((results) => {
      const twitterAnalysis = JSON.parse(results[0]).analysis;
      const disqusAnalysis = JSON.parse(results[1]).analysis;
      const processedTwitter = twitterPreprocessingLogic.formatUserTwitterEntityAnalysis(userId, twitterAnalysis);
      const processedDisqus = disqusPreprocessingLogic.formatUserDisqusEntityAnalysis(userId, disqusAnalysis);
      const fileWriteTasks = [
        fs.writeFileAsync(`${baseAnalysisDirectory}/twitter-store`, JSON.stringify(processedTwitter, null, 2)),
        fs.writeFileAsync(`${baseAnalysisDirectory}/disqus-store`, JSON.stringify(processedDisqus, null, 2)),
      ];

      return Promise.all(fileWriteTasks);
    })
    .then(() => callback())
    .catch((err) => callback(err));

};

exports.preprocessUserEntityData = preprocessUserEntityData;

const preprocessingTask = (userDirectory, taskIndex, callback) => {
  const userId = userDirectory.split('/')[4];
  preprocessUserEntityData(userId, (err) => {
    if (err) {
      console.log(err.message);
      callback();
      return;
    }

    callback();
  })
};

const userDirectories = fileLogic.getDirectories(analysisDirectory);
async.forEachOfSeries(userDirectories, preprocessingTask, (err) => {
  if (err) {
    console.log(err.message);
    return;
  }
  
  console.log('Tasks executed successfully');
});