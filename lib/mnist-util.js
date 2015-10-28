var Util = module.exports = {};

Util.chunkImage = function(image) {
  var chunks = [];
  var dim = 27;
  var numChunks = 81;
  for (var i = 0; i < numChunks; ++i) {
    var chunk = [];
    var startRow = Math.floor(i / Math.sqrt(numChunks)) * 3;
    for (var row = startRow; row < startRow + 3; ++row) {
      var startCol = (i % Math.sqrt(numChunks)) * 3;
      for (var col = startCol; col < startCol + 3; ++col) {
        chunk.push(image[row * 28 + col])
      }
    }
    chunks.push(chunk);
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

