const path = require('path');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));

const networkLogic = Promise.promisifyAll(require('../network'));
const genericLogic = Promise.promisifyAll(require('./generic'));

const getDisqusCommentsSync = (userId) => {
  const userDirectory = `/media/${userId}/disqus_comments.json`;
  const disqusDataFilePath = path.join(process.env.HOME, userDirectory);
  try {
    const fileContent = fs.readFileSync(disqusDataFilePath).toString();
    const disqusProfileData = JSON.parse(fileContent);
    return disqusProfileData.comments;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
  }
};

exports.getDisqusCommentsSync = getDisqusCommentsSync;

const getDisqusComments = (userId, callback) => {
  const userDirectory = `/media/${userId}/disqus_comments.json`;
  const disqusDataFilePath = path.join(process.env.HOME, userDirectory);
  fs.readFileAsync(disqusDataFilePath)
    .then((fileContent) => {
      const comments = JSON.parse(fileContent).comments;
      callback(null, comments);
    })
    .catch((err) => callback(err));
};

exports.getDisqusComments = getDisqusComments;

const getCommentTextSetForDisqus = (userId, setSize) => {
  const comments = getDisqusCommentsSync(userId);
  console.log(`User has ${comments.length} disqus comments`);
  let commentTextSet = [];
  let startIndex = 0;

  let totalText = '';

  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i];
    const commentText = comment.post;
    const totalLength = totalText.length + commentText.length + 1;

    if (totalLength > setSize) {
      const commentText = {
        text: totalText,
        startIndex,
        endIndex: i - 1,
        startTime: comments[startIndex].time,
        endTime: comments[i - 1].time,
      };
      commentTextSet.push(commentText);
      totalText = '';
      startIndex = i;
    }

    totalText += commentText;
  }

  if (totalText.length) {
    const commentText = {
      text: totalText,
      startTime: comments[startIndex].time,
      startIndex,
      endIndex: comments.length - 1,
      endTime: comments[comments.length - 1].time,
    };
    commentTextSet.push(commentText);
  }

  return commentTextSet;
}

exports.getCommentTextSetForDisqus = getCommentTextSetForDisqus;

const getDisqusAnalysisForUser = (userDirectory, callback) => {
  const userId = userDirectory.split('/')[4];
  const disqusCommentTextSet = getCommentTextSetForDisqus(userId, 2000);
  const analysisTask = (comment) => networkLogic.getAlchemyAnalysisAsync(comment.text);

  console.log(`Starting analysis for ${disqusCommentTextSet.length} disqus comment chunks`);

  Promise.map(disqusCommentTextSet, analysisTask, { concurrency: 4 })
    .then((alchemyResponseList) => {
      const analysis = genericLogic.constructEntityAnalysisEntryList(disqusCommentTextSet, alchemyResponseList);
      console.log(`${analysis.length} comment chunks has entities`);
      const userDisqusAnalysis = {
        userId,
        analysis,
      };

      callback(null, userDisqusAnalysis);
    })
    .catch((err) => {
      callback(err);
    })
};

exports.getDisqusAnalysisForUser = getDisqusAnalysisForUser;
