const shouldUserBeAnalyzed = (userId) => {
  const twitterPosts = getTwitterPosts(userId);
  const disqusComments = getDisqusComments(userId);

  if (twitterPosts.length > 100 && disqusComments.length > 50) {
    return true;
  }

  return false;
};

exports.shouldUserBeAnalyzed = shouldUserBeAnalyzed;

const constructEntityAnalysisEntryList = (textSet, alchemyResponseList) => {
  const commentTextAnalysisList = [];

  for (let i = 0; i < textSet.length; i++) {
    const alchemyResponse = alchemyResponseList[i];
    if (alchemyResponse.entities) {
      const analysis = {
        text: textSet[i].text,
        startIndex: textSet[i].startIndex,
        endIndex: textSet[i].endIndex,
        startTime: textSet[i].startTime,
        endTime: textSet[i].endTime,
        entities: alchemyResponse.entities,
      }

      commentTextAnalysisList.push(analysis);
    }
  }

  return commentTextAnalysisList;
};

exports.constructEntityAnalysisEntryList = constructEntityAnalysisEntryList;
