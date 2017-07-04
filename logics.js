const path = require('path');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const request = require('request');
var querystring = require('querystring');

const getDirectories = (srcpath) => {
  const directoryNames = fs.readdirSync(srcpath)
    .filter(file => fs.lstatSync(path.join(srcpath, file)).isDirectory());

  return directoryNames.map(directoryName => `${srcpath}/${directoryName}`);
};

exports.getDirectories = getDirectories;

const deleteFolderRecursive = function(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function(file, index) {
      const curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

const getDisqusComments = (userId) => {
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

const getTwitterPosts = (userId) => {
  const userDirectory = `/media/${userId}/twitter_timeline.json`;
  const twitterDataFilePath = path.join(process.env.HOME, userDirectory);
  try {
    const fileContent = fs.readFileSync(twitterDataFilePath).toString();
    return JSON.parse(fileContent)
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
  };
}

const getCommentTextSetForDisqus = (userId, setSize) => {
  const comments = getDisqusComments(userId);
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
        endIndex: i,
        startTime: comments[startIndex].time,
        endTime: comments[i].time,
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

const getAlchemyAnalysis = (text, callback) => {
  const form = {
    linkedData: 1,
    text,
    sentiment: 1,
    emotion: 1,
  };

  const formData = querystring.stringify(form);
  const contentLength = formData.length;

  const options = {
    headers: {
      'Content-Length': contentLength,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    uri: 'https://alchemy-language-demo.mybluemix.net/api/entities',
    body: formData,
    method: 'POST',
    timeout: 60 * 1000,
  }

  request(options, (err, response, body) => {
    if (err) {
      if (err.message.includes('ETIMEDOUT') || err.message.includes('socket hang up') || err.message.includes('ESOCKETTIMEDOUT')) {
        setTimeout(() => {
          getAlchemyAnalysis(text, callback);
        }, 5 * 60 * 1000);
        return;
      }

      callback(err);
      return;
    }

    const responseJson = JSON.parse(body);
    callback(null, responseJson);
  });
};

exports.getAlchemyAnalysis = getAlchemyAnalysis;

const constructDisqusAnalysisEntryForUser = (disqusCommentTextSet, alchemyResponseList) => {
  const commentTextAnalysisList = [];

  for (let i = 0; i < disqusCommentTextSet.length; i++) {
    const alchemyResponse = alchemyResponseList[i];
    if (alchemyResponse.entities) {
      const analysis = {
        commentText: disqusCommentTextSet[i].text,
        startIndex: disqusCommentTextSet[i].startIndex,
        endIndex: disqusCommentTextSet[i].endIndex,
        startTime: disqusCommentTextSet[i].startTime,
        endTime: disqusCommentTextSet[i].endTime,
        entities: alchemyResponse.entities,
      }

      commentTextAnalysisList.push(analysis);
    }
  }

  return commentTextAnalysisList;
}

const getDisqusAnalysisForUser = (userId, callback) => {
  const getAlchemyAnalysisAsync = Promise.promisify(getAlchemyAnalysis);
  const disqusCommentTextSet = getCommentTextSetForDisqus(userId, 2000);
  const disqusAnalysisTasks = disqusCommentTextSet.map((disqusCommentText) => getAlchemyAnalysisAsync(disqusCommentText.text));

  Promise.map(disqusAnalysisTasks, { concurrency: 4 })
    .then((alchemyResponseList) => {
      const analysis = constructDisqusAnalysisEntryForUser(disqusCommentTextSet, alchemyResponseList);
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

const shouldUserBeAnalyzed = (userId) => {
  const twitterPosts = getTwitterPosts(userId);
  const disqusComments = getDisqusComments(userId);

  if (twitterPosts.length > 100 && disqusComments.length > 50) {
    return true;
  }

  return false;
};

const rootDirectory = '/home/saad-galib/media';
const userDirectories = getDirectories(rootDirectory);
const result = userDirectories.forEach((userDirectory) => {
  const userId = userDirectory.split('/')[4];
  const flag = shouldUserBeAnalyzed(userId);

  if (flag) {
    return;
  }

  console.log(`Deleting ${userDirectory}`);
  deleteFolderRecursive(userDirectory);
});
