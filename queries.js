const fs = require('fs');

const logics = require('./logics');
const rootDirectory = '/home/saad-galib/media';
const userDirectories = logics.getDirectories(rootDirectory);

const getRecurrentTopicPercentage = (userId) => {
  const disqusDataStoreFilePath = `/home/saad-galib/entity-analysis/${userId}/disqus-data-store.json`;
  const fileContent = fs.readFileSync(disqusDataStoreFilePath).toString();
  const disqusTopicData = (JSON.parse(fileContent)).entityList;
  const numtotalTopics = disqusTopicData.length;
  if (numtotalTopics === 0) {
    return 0;
  }

  const numRecurrentTopics = (disqusTopicData.filter((topic) => topic.count > 1)).length;
  return (numRecurrentTopics / numtotalTopics) * 100;
};

const userHasTopics = (userId) => {
  const disqusDataStoreFilePath = `/home/saad-galib/entity-analysis/${userId}/disqus-data-store.json`;
  const fileContent = fs.readFileSync(disqusDataStoreFilePath).toString();
  const disqusTopicData = (JSON.parse(fileContent)).entityList;
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

console.log(getRecurrentTopicUserPercentage());

const getTopicIntersection = (userId) => {

};
