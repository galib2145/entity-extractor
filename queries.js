const fs = require('fs');

const fileLogic = require('./logic/file');
const rootDirectory = '/home/saad-galib/media';
const userDirectories = fileLogic.getDirectories(rootDirectory);

const getDisqusTopicData = (userId) => {
  const disqusDataStoreFilePath = `/home/saad-galib/Downloads/entity-analysis-2/${userId}/disqus-store`;
  const fileContent = fs.readFileSync(disqusDataStoreFilePath).toString();
  return (JSON.parse(fileContent)).entityList;
};

const getTwitterTopicData = (userId) => {
  const disqusDataStoreFilePath = `/home/saad-galib/Downloads/entity-analysis-2/${userId}/twitter-store`;
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

    return intrNum / disqusTopicData.length;
  } catch (err) {
    return 0;
  }
};

const intersectionArray = [];

userDirectories.forEach((dir) => {
  const userId = dir.split('/')[4];
  const percentage = getDisqusTopicIntersectionPercentage(userId);
  intersectionArray.push({
    userId,
    intersection,
  });
});

console.log(`Total acceptable intersection: ${intersectionArray.length}`);
fs.writeFileSync('/home/saad-galib/intersection-report', JSON.stringify(intersectionArray, null, 2));
