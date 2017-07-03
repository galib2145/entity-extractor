const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const logics = Promise.promisifyAll(require('./logics'));
const async = require('async');

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

const task = (post, callback) => {
  logics.getAlchemyAnalysis(post.text, (err, result) => {
    if (err) {
      callback(err);
      return;
    }

    callback(null, result);
  });
}

const getTwitterAnalysisForUser = (userDirectory, callback) => {
  const twitterPosts = getTwitterPosts(userDirectory, 2000);

  if (!twitterPosts) {
    callback(new Error('No twitter text found!'));
    return;
  }

  async.mapSeries(twitterPosts, task, (err, result) => {
    if (err) {
      callback(err);
      return;
    }

    callback(result);
  });
};

exports.getTwitterAnalysisForUser = getTwitterAnalysisForUser;

console.log(`Start: ${new Date()}`);
getTwitterAnalysisForUser('/home/saad-galib/media/11327_chrisvicious77', (err, result) => {
  if (err) {
    console.log(err);
    return;
  }

  console.log(`End: ${new Date()}`);
  console.log('Tasks done successfully!');
});
