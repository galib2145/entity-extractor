const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const logics = Promise.promisifyAll(require('./logics'));

const getTwitterPosts = (filePath) => {
  const twitterFilePath = `${filePath}/twitter_timeline.json`;
  try {
    const fileContent = fs.readFileSync(twitterFilePath).toString();
    return JSON.parse(fileContent);
  } catch (err) {
    return null;
  }
}

const constructAnalysisEntryForUser = (twitterPost, alchemyResponseList) => {
  const textAnalysisList = [];

  for (let i = 0; i < twitterPost.length; i++) {
    const alchemyResponse = alchemyResponseList[i];
    if (alchemyResponse.entities) {
      const analysis = {
        text: twitterPost[i].text,
        time: twitterPost[i].time,
        entities: alchemyResponse.entities,
      }

      textAnalysisList.push(analysis);
    }
  }

  return textAnalysisList;
}

const getTwitterAnalysisForUser = (userDirectory, callback) => {
  const twitterPosts = getTwitterPosts(userDirectory, 2000);

  if (!twitterPosts) {
    callback(new Error('No twitter text found!'));
    return;
  }

  const twitterAnalysisTasks = twitterPosts.map((post, index) => logics.getAlchemyAnalysisAsync(post.text, index));

  Promise.all(twitterAnalysisTasks)
    .then((alchemyResponseList) => {
      const analysis = constructAnalysisEntryForUser(twitterPosts, alchemyResponseList);
      const userId = userDirectory.split('/')[4];
      const userTwitterAnalysis = {
        userId,
        analysis,
      };

      callback(null, userTwitterAnalysis);
    })
    .catch((err) => {
      callback(err);
    })

};

exports.getTwitterAnalysisForUser = getTwitterAnalysisForUser;

getTwitterAnalysisForUser('/home/saad-galib/media/11327_chrisvicious77', () => {

});
