const path = require('path');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const _ = require('lodash');

const networkLogic = Promise.promisifyAll(require('../network'));
const genericLogic = Promise.promisifyAll(require('./generic'));

const getTwitterPosts = (userId) => {
  const userDirectory = `/media/${userId}/twitter_timeline.json`;
  const twitterDataFilePath = path.join(process.env.HOME, userDirectory);
  try {
    const fileContent = fs.readFileSync(twitterDataFilePath).toString();
    return JSON.parse(fileContent)
  } catch (err) {
    throw err;
  };
};

exports.getTwitterPosts = getTwitterPosts;

const getPostTextSetTwitter = (userId, setSize) => {
  const posts = getTwitterPosts(userId);
  let postTextSet = [];
  let startIndex = 0;

  let totalText = '';

  console.log(`User has ${posts.length} twitter posts`);

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const postText = post.text;
    const totalLength = totalText.length + postText.length + 1;

    if (totalLength > setSize) {
      const postText = {
        text: totalText,
        startIndex,
        endIndex: i - 1,
        startTime: posts[startIndex].time,
        endTime: posts[i - 1].time,
      };
      postTextSet.push(postText);
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
    postTextSet.push(postText);
  }

  return postTextSet;
}

exports.getPostTextSetTwitter = getPostTextSetTwitter;

const getTwitterAnalysisForUser = (userDirectory, callback) => {
  const userId = userDirectory.split('/')[4];
  const postTextSet = getPostTextSetTwitter(userId, 2000);

  if (!postTextSet || postTextSet.length === 0) {
    callback(new Error('No twitter text found!'));
    return;
  }

  const analysisTask = (post) => networkLogic.getAlchemyAnalysisAsync(post.text);
  console.log(`Starting analysis for ${postTextSet.length} twitter post chunks`);

  Promise.map(postTextSet, analysisTask, { concurrency: 4 })
    .then((alchemyResponseList) => {
      const analysis = genericLogic.constructEntityAnalysisEntryList(postTextSet, alchemyResponseList);
      console.log(`${analysis.length} post chunks has entities`);
      const userId = userDirectory.split('/')[4];
      const userTwitterAnalysis = {
        userId,
        analysis,
      };

      callback(null, userTwitterAnalysis);
    })
    .catch((err) => {
      callback(err);
    });
};

exports.getTwitterAnalysisForUser = getTwitterAnalysisForUser;
