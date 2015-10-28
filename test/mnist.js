var Expect = require('chai').expect;
var Util = require('../lib/mnist-util.js');

describe('mnist utils', function() {
  it('should compute chunk indices', function() {
    var idx = Util.getChunkIndices(81, 3, 0, 0);
    Expect(idx).to.deep.equal([0, 1, 2, 81, 82, 83, 162, 163, 164])

    idx = Util.getChunkIndices(81, 3, 1, 1);
    Expect(idx).to.deep.equal([246, 247, 248, 327, 328, 329, 408, 409, 410]);
  })
})
