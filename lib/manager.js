var _ = require('lodash');
var GenId = require('shortid').generate;
var M = require('mathjs');

var Neuron = require('./neuron.js');

var NEURON_OPTS = {
  maxHistory: 3,
  interval: 100,
  dimensions: {hidden: 4},
}

var CONST_OPTS = {
}

var OUT_OPTS = {
  interval: 0,
}

var PORTS = [];
for (var i = 3001; i < 4000; ++i) PORTS.push(i);

var NUM_NEURONS = 2;

var INPUT = {
  bark: M.matrix([2, 0]),
  quack: M.matrix([0, 2]),
}

var OUTPUT = {
  dog: M.matrix([1, 1, 1, 1]),
  duck: M.matrix([-1, -1, -1, -1]),
}

var Manager = module.exports = function(opts) {
  var self = this;
  self.options = opts;

  self.neurons = [];

  for (var i = 0; i < NUM_NEURONS; ++i) {
    self.neurons.push(new Neuron(_.extend({
      port: PORTS.shift(),
      id:i,
      verbose: i == 1,
    }, NEURON_OPTS)))
  }

  self.samples = [
    {input: INPUT.quack, output: OUTPUT.duck, label: 'quack'},
    {input: INPUT.bark, output: OUTPUT.dog, label: 'bark'},
  ]
  self.samples.forEach(function(s) {
    s.neuron = new Neuron(_.extend({
      id: s.label,
      port: PORTS.shift(),
    }, NEURON_OPTS, CONST_OPTS));
    s.neuron.hold({id: 'const', signal: s.input});
  })

  self.output = new Neuron(_.extend({
    id: 'output',
    port: PORTS.shift(),
  }, NEURON_OPTS, OUT_OPTS));

  //self.connect(self.neurons[0], self.neurons[1]);
  self.connect(self.neurons[0], self.output);
}

Manager.prototype.connect = function(fromNeuron, toNeuron) {
  fromNeuron.subscribe({id: toNeuron.id, location: 'http://127.0.0.1:' + toNeuron.options.port});
}

Manager.prototype.train = function(ms, done) {
  this.run(ms, null, done);
}

Manager.prototype.run = function(ms, testSample, done) {
  var self = this;
  var interval = setInterval(function() {
    var sample = testSample;
    if (!sample) {
      var sampleIdx = Math.floor(2.0 * Math.random());
      sample = self.samples[sampleIdx];
    }
    self.samples.forEach(function(other) {
      other.neuron.unsubscribe(self.neurons[0].id);
    });
    console.log('\n\n\nTRAINING SAMPLE', sample.label);
    if (!testSample) self.neurons[0].hold({id: 'TRAIN', signal: sample.output});
    self.connect(sample.neuron, self.neurons[0]);
  }, 1000);

  setTimeout(function() {
    self.samples.forEach(function(other) {
      other.neuron.unsubscribe(self.neurons[0].id);
    });
    self.neurons[0].release();
    clearInterval(interval);
    if (done) done();
  }, ms);
}

