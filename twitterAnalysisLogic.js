const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const logics = Promise.promisifyAll(require('./logics'));

const getTextSetForTwitter = (filePath, setSize) => {
  const twitterFilePath = `${filePath}/twitter_timeline.json`;
  let textSet = [];
  let startIndex = 0;

  try {
    const fileContent = fs.readFileSync(twitterFilePath).toString();
    const twitterProfileData = JSON.parse(fileContent);
    const posts = twitterProfileData;

    let totalText = '';

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const postText = post.text;
      const totalLength = totalText.length + postText.length + 1;

      if (totalLength > setSize) {
        const postText = {
          text: totalText,
          startIndex,
          endIndex: i,
          startTime: posts[startIndex].time,
          endTime: posts[i].time,
        };
        textSet.push(postText);
        totalText = '';
        startIndex = i;
      }

      totalText += postText;
    }

    if (totalText.length) {
      const postText = {
        text: totalText,
        startTime: posts[startIndex].time,
        startIndex,
        endIndex: posts.length - 1,
        endTime: posts[posts.length - 1].time,
      };
      textSet.push(postText);
    }

    return textSet;
  } catch (err) {
    return null;
  }
};

const constructAnalysisEntryForUser = (textSet, alchemyResponseList) => {
  const textAnalysisList = [];

  for (let i = 0; i < textSet.length; i++) {
    const alchemyResponse = alchemyResponseList[i];
    if (alchemyResponse.entities) {
      const analysis = {
        commentText: textSet[i].text,
        startIndex: textSet[i].startIndex,
        endIndex: textSet[i].endIndex,
        startTime: textSet[i].startTime,
        endTime: textSet[i].endTime,
        entities: alchemyResponse.entities,
      }

      textAnalysisList.push(analysis);
    }
  }

  return textAnalysisList;
}

const getTwitterAnalysisForUser = (userDirectory, callback) => {
  const twitterTextSet = getTextSetForTwitter(userDirectory, 2000);

  if (!twitterTextSet) {
    callback(new Error('No twitter text found!'));
    return;
  }

  const analysisTask = (post) => logics.getAlchemyAnalysisAsync(post.text);

  Promise.map(twitterTextSet, analysisTask, { concurrency: 3 })
    .then((alchemyResponseList) => {
      const analysis = constructAnalysisEntryForUser(twitterTextSet, alchemyResponseList);
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

getTwitterAnalysisForUser('/home/saad-galib/media/1000_bigyahu', (err, result) => {
  if (err) {
    console.log(err);
    return;
  }

  console.log('Done!');
});
