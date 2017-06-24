const fs = require('fs');

const getExactEntityMentionTimes = (entityText, comments) => {
  const mentionedPosts = comments.filter((comment) => comment.post.includes(entityText));
  const mentionTimes = mentionedPosts.map((post) => post.time);
  return mentionTimes.filter((elem, index, self) => {
    return index == self.indexOf(elem);
  });
}

const getProcessedEntityInfoList = (analysisList, comments) => {
  const entities = {};
  for (let i = 0; i < analysisList.length; i += 1) {
    const searchStartIndex = analysisList[i].startIndex;
    const searchEndIndex = analysisList[i].endIndex;
    const commentsToSearch = comments.slice(searchStartIndex, searchEndIndex + 1);
    const entityInfoList = analysisList[i].entities;

    for (let j = 0; j < entityInfoList.length; j += 1) {
      const entityInfo = entityInfoList[j];
      const entityText = entityInfo.text;
      const mentionTimes = getExactEntityMentionTimes(entityText, commentsToSearch);

      if (entities[entityText]) {
        entities[entityText].count += mentionTimes.length;
        entities[entityText].mentionTimes = entities[entityText].mentionTimes.concat(mentionTimes);   
      } else {
        entities[entityText] = {
          count: mentionTimes.length,
          mentionTimes,    
        };  
      }   
    }     
  }

  return entities;
};

const analysisFilePath = '/home/saad/entity-analysis/18_reinout/disqus.json';
const postsFilePath = '/home/saad/media/18_reinout/disqus_comments.json';

const analysis = JSON.parse((fs.readFileSync(analysisFilePath))).analysis;
const comments = JSON.parse((fs.readFileSync(postsFilePath))).comments;

console.log(JSON.stringify(getProcessedEntityInfoList(analysis, comments), null, 2));

