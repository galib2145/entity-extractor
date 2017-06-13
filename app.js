const fs = require('fs');
const request = require('request');
var querystring = require('querystring');
const async = require('async');

const logics = require('./logics');

const fileContent = fs.readFileSync('disqus_comments.json').toString();
const disqusProfileData = JSON.parse(fileContent);
const comments = disqusProfileData.comments;

let totalText = '';

const rootDirectory = '/home/saad/demo';

for (let i = 0; i < comments.length; i++) {
    const comment = comments[i];
    const commentText = comment.post;
    const totalLength = totalText.length + commentText.length + 1;

    if (totalLength > 10000) {
        break;
    }

    totalText += commentText;
}

const form = {
    text: totalText,
    linkedData: 1,
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

const requestData = (callback) => {
    request(options, (err, response, body) => {
        if (err) {
            callback(err);
            return;
        }

        callback(null, JSON.parse(body));
    });
};

const userDirectories = logics.getDirectories(rootDirectory);

const disqusAnalysisTask = (userDirectory, taskIndex, callback) => {
    console.log(`Executing task: ${taskIndex}`);
    logics.getDisqusAnalysisForUser(userDirectory, (err) => {
        if (err) {
            callback(err);
            return;
        }

        callback();
    });
};


async.forEachOfSeries(userDirectories, disqusAnalysisTask, (err) => {
    if (err) {
        console.log(err);
        return;
    }

    console.log('Tasks executed successfully');
});






