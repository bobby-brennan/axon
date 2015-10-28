var Util = module.exports = {};

Util.getChunkIndices = function(inputSize, chunkSize, chunkRow, chunkCol) {
  var indices = [];
  var startRow = chunkRow * chunkSize;
  for (var row = startRow; row < startRow + chunkSize; ++row) {
    var startCol = chunkCol * chunkSize;
    for (var col = startCol; col < startCol + chunkSize; ++col) {
      indices.push(row * inputSize + col);
    }
  }
  return indices;
}

Util.chunkImage = function(image) {
  var chunks = [];
  var dim = 27;
  var numChunks = 81;

  for (var row = 0; row < 9; ++row) {
    for (var col = 0; col < 9; ++col) {
      var indices = Util.getChunkIndices(28, 3, row, col);
      chunks.push(indices.map(function(idx) {return image[idx]}));
    }
  }

  return chunks;
}

Util.displayPixel = function(value) {
    var output = ' ';
    if (value > .25) output = '.';
    if (value > .5) output = 'x';
    process.stdout.write(output + ' ')
}

Util.displayImage = function(image) {
  var size = Math.sqrt(image.length);
  for (var i = 0; i < size; ++i) {
    for (var j = 0; j < size; ++j) {
      Util.displayPixel(image[size * i + j]);
    }
    console.log()
  }
}

Util.displayImages = function(images) {
  var size = Math.sqrt(images[0].length);
  for (var i = 0; i < size; ++i) {
    for (var im = 0; im < images.length; ++im) {
      for (var j = 0; j < size; ++j) {
        Util.displayPixel(images[im][size * i + j]);
      }
      process.stdout.write(' | ')
    }
    console.log()
  }
}

var testDisplay = function() {
  var im = require('mnist').set(1, 1).training[0].input;
  Util.displayImage(im);
  var chunks = Util.chunkImage(im);
  for (var i = 0; i < 9; ++i) {
    var images = [];
    for (var j = 0; j < 9; ++j) images.push(chunks[9*i+j]);
    Util.displayImages(images);
  }
}
