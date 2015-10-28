var Util = module.exports = {};

Util.chunkImage = function(image) {
  var chunks = [];
  for (var i = 0; i < 9; ++i) {
    var chunk = [];
    var startRow = Math.floor(i / 3) * 9;
    for (var row = startRow; row < startRow + 9; ++row) {
      var startCol = (i % 3) * 9;
      for (var col = startCol; col < startCol + 9; ++col) {
        chunk.push(image[row * 28 + col])
      }
    }
    chunks.push(chunk);
  }
  return chunks;
}

Util.displayImage = function(image) {
  var size = Math.sqrt(image.length);
  for (var i = 0; i < size; ++i) {
    for (var j = 0; j < size; ++j) {
      var value = image[size * i + j];
      var output = ' ';
      if (value > .25) output = '.';
      if (value > .5) output = 'x';
      process.stdout.write(output + ' ')
    }
    console.log()
  }
}

var mnist = require('mnist')
var set = mnist.set(10, 10)
Util.displayImage(set.training[0].input);
var chunks = Util.chunkImage(set.training[0].input)
for (var i = 0; i < chunks.length; ++i) Util.displayImage(chunks[i])
