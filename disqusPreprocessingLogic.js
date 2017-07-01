const fs = require('fs');
const async = require('async');
const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;
const url = 'mongodb://localhost:27017/test';
const logics = require('./logics');
const rootDirectory = '/home/saad-galib/media';
const userDirectories = logics.getDirectories(rootDirectory);

const timeParser = require('./timeParser');

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

const storeUserData = (userDirectory) => {
  const userId = userDirectory.split('/')[4];
  const analysisFilePath = `/home/saad-galib/entity-analysis/${userId}/disqus.json`;
  const postsFilePath = `/home/saad-galib/media/${userId}/disqus_comments.json`;
  const disqusDataStoreFilePath = `/home/saad-galib/entity-analysis/${userId}/disqus-data-store.json`;

  const analysis = JSON.parse((fs.readFileSync(analysisFilePath))).analysis;
  const comments = JSON.parse((fs.readFileSync(postsFilePath))).comments;

  const entityList = getProcessedEntityInfoList(analysis, comments);

  const userEntry = {
    username: userId,
    entityList,
  };

  fs.writeFileSync(disqusDataStoreFilePath, JSON.stringify(userEntry, null, 2));
};

exports.getUserData = storeUserData;

userDirectories.forEach((userDirectory, index) => {
  storeUserData(userDirectory);
});

console.log('Done');
