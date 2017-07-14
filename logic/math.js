const getDotProduct = (vec1, vec2) => {
  const mult = vec1.map((e, i) => e * vec2[i]);
  const result = mult.reduce((sum, value) => {
    return sum + value;
  }, 0);

  return result;
};

exports.getDotProduct = getDotProduct;