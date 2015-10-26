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
  dimensions: {hidden: 2},
}

var OUT_OPTS = {
  interval: 0,
  dimensions: {hidden: 4},
}

var PORTS = [];
for (var i = 3001; i < 4000; ++i) PORTS.push(i);

var NUM_NEURONS = 2;

var INPUT = {
  bark: M.matrix([2, 0]),
  quack: M.matrix([0, 2]),
  woof: M.matrix([-1, -1]),
}

var OUTPUT = {
  dog: M.matrix([1, 2, 3, 4]),
  duck: M.matrix([2, -2, 2, -2]),
}

var Manager = module.exports = function(opts) {
  var self = this;
  self.options = opts;

  self.neurons = [];

  for (var i = 0; i < NUM_NEURONS; ++i) {
    self.neurons.push(new Neuron(_.extend({
      port: PORTS.shift(),
      id: 'n' + i,
      verbose: i == 1,
    }, NEURON_OPTS)))
  }

  self.samples = [
    {input: INPUT.quack, output: OUTPUT.duck, inputLabel: 'quack', outputLabel: 'duck'},
    {input: INPUT.woof, output: OUTPUT.dog, inputLabel: 'woof', outputLabel: 'dog'},
    {input: INPUT.bark, output: OUTPUT.dog, inputLabel: 'bark', outputLabel: 'dog'},
  ]
  self.samples.forEach(function(s) {
    s.neuron = new Neuron(_.extend({
      id: s.inputLabel,
      port: PORTS.shift(),
    }, NEURON_OPTS, CONST_OPTS));
    s.neuron.hold({id: 'const', signal: s.input});
  })

  var opts = _.extend({
    id: 'output',
    port: PORTS.shift(),
  }, NEURON_OPTS, OUT_OPTS);
  console.log('out opts', opts);
  self.output = new Neuron(opts);
  self.connect(self.neurons[0], self.neurons[1]);
  self.outputNeuron = self.neurons[1];
  self.subscribe(self.outputNeuron, self.output);
}

Manager.prototype.findClosestSample = function(data) {
  var lowest = 2.0;
  var closest = null;
  console.log('find closest', data._data);
  this.samples.forEach(function(s) {
    var dist = Neuron.getDistance(s.output, data);
    if (dist < lowest) {
      console.log('closer', dist, s.output._data);
      closest = s;
      lowest = dist;
    }
  })
  return closest;
}

Manager.prototype.subscribe = function(fromNeuron, toNeuron) {
  fromNeuron.subscribe({id: toNeuron.id, location: 'http://127.0.0.1:' + toNeuron.options.port});
}

Manager.prototype.connect = function(n1, n2) {
  this.subscribe(n1, n2);
  this.subscribe(n2, n1);
}

Manager.prototype.disconnect = function(n1, n2) {
  n2.unsubscribe(n1.id);
  n1.unsubscribe(n2.id);
}

Manager.prototype.train = function(ms, done) {
  this.run(ms, null, done);
}

Manager.prototype.run = function(ms, testSample, done) {
  var self = this;
  var interval = setInterval(function() {
    var sample = testSample;
    if (!sample) {
      var sampleIdx = Math.floor(self.samples.length * Math.random());
      sample = self.samples[sampleIdx];
    }
    self.samples.forEach(function(other) {
      self.disconnect(other.neuron, self.neurons[0]);
    });
    console.log('\n\n\nTRAINING SAMPLE', sample.inputLabel);
    if (!testSample) self.outputNeuron.hold({id: 'TRAIN', signal: sample.output});
    self.subscribe(sample.neuron, self.neurons[0]);
  }, 1000);
  console.log('finishing in', ms);
  setTimeout(function() {
    console.log('DONE');
    clearInterval(interval);
    if (testSample) {
      var curState = self.outputNeuron.state.hidden;
      var closest = self.findClosestSample(curState);
      console.log('CLASSIFIED', testSample.inputLabel, 'as', closest.outputLabel);
    }
    self.samples.forEach(function(other) {
      self.disconnect(other.neuron, self.neurons[0]);
    });
    self.outputNeuron.release();
    if (done) done();
  }, ms);
}

