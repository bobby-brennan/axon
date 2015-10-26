var Expect = require('chai').expect;
var M = require('mathjs');

var Neuron = require('../lib/neuron.js');

var ExpectAlmost = function(value, expect) {
  Expect(value).to.be.below(expect + .000001);
  Expect(value).to.be.above(expect - .000001);
}

global.verbose = true;

describe('neuron', function() {
  it('should get distance right', function() {
    var n = new Neuron({});
    n.state.hidden = M.matrix([.1, .1]);
    ExpectAlmost(n.getDistance(M.matrix([.1, .1])), 0)
    ExpectAlmost(n.getDistance(M.matrix([.3, .3])), 0)
    ExpectAlmost(n.getDistance(M.matrix([-1, -1])), 1)
    ExpectAlmost(n.getDistance(M.matrix([.1, -.1])), .5);
  })

  it('should adjust transform appropraitely', function() {
    var n = new Neuron({
      dimensions: {hidden: 2},
    });

    var transformStart = M.matrix([[1, 0], [0, 1]]);
    var hidden = M.matrix([.1, .1]);
    var signal = M.matrix([-.1, -.1]);
    var transformEnd = M.matrix([[-1, 0], [0, -1]]);

    n.state.transforms['test'] = transformStart;
    n.state.hidden = hidden;
    var input = {id: 'test', signal: signal}
    n.adjustTransform(input, n.transform(input));
    Expect(n.state.transforms['test']).to.deep.equal(transformEnd);
  })
})
