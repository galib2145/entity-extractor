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

const getCommentTextSetForDisqus = (filePath, setSize) => {
  const disqusDataFilePath = `${filePath}/disqus_comments.json`;
  const fileContent = fs.readFileSync(disqusDataFilePath).toString();
  const disqusProfileData = JSON.parse(fileContent);
  const comments = disqusProfileData.comments;
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
  }

  request(options, (err, response, body) => {
    if (err) {
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

const getDisqusAnalysisForUser = (userDirectory, callback) => {
  const getAlchemyAnalysisAsync = Promise.promisify(getAlchemyAnalysis);
  const disqusCommentTextSet = getCommentTextSetForDisqus(userDirectory, 2000);
  const disqusAnalysisTasks = disqusCommentTextSet.map((disqusCommentText) => getAlchemyAnalysisAsync(disqusCommentText.text));

  Promise.all(disqusAnalysisTasks)
    .then((alchemyResponseList) => {
      const analysis = constructDisqusAnalysisEntryForUser(disqusCommentTextSet, alchemyResponseList);
      const userId = userDirectory.split('/')[4];
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
