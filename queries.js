const fs = require('fs');

const logics = require('./logics');
const rootDirectory = '/home/saad-galib/media';
const userDirectories = logics.getDirectories(rootDirectory);

const getDisqusTopicData = (userId) => {
  const disqusDataStoreFilePath = `/home/saad-galib/entity-analysis/${userId}/disqus-data-store.json`;
  const fileContent = fs.readFileSync(disqusDataStoreFilePath).toString();
  return (JSON.parse(fileContent)).entityList;
};

const getTwitterTopicData = (userId) => {
  const disqusDataStoreFilePath = `/home/saad-galib/entity-analysis/${userId}/twitter-data-store.json`;
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

const getTopicIntersection = (userId) => {
  const disqusTopicData = getDisqusTopicData(userId);
  const twitterTopicData = getTwitterTopicData(userId);

  const mapped = disqusTopicData.map((disqusEntry) => {
    const match = twitterTopicData.find((twitterEntry) => twitterEntry.entity === disqusEntry.entity);
    if (match) {
      return 1;
    }

    return 0;
  });

  return mapped.reduce((prevVal, elem) => {
    return prevVal + elem;
  }, 0);
};

console.log(getTopicIntersection('1000_bigyahu'));
