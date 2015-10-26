var _ = require('lodash');
var GenId = require('shortid').generate;
var M = require('mathjs');

var Neuron = require('./neuron.js');

var MAX_SAMPLES = 2;
var NUM_NEURONS = 3;

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

var INPUT = {
  quack: M.matrix([0, 40]),
  bark: M.matrix([40, 0]),
  woof: M.matrix([-20, -20]),
  neigh: M.matrix([20, -20]),
  oink: M.matrix([-20, 20]),
  snort: M.matrix([-40, 0]),
}

var OUTPUT = {
  dog: M.matrix([1, 2, 3, 4]),
  duck: M.matrix([2, -2, 2, -2]),
  pig: M.matrix([4, 0, 0, 4]),
  horse: M.matrix([-2, 4, 0, 0]),
}

var INPUT_NORM = 10;
var OUTPUT_NORM = 30;
for (var sound in INPUT) {
  INPUT[sound] = M.multiply(INPUT[sound], INPUT_NORM / M.norm(INPUT[sound]))
}
for (var sound in OUTPUT) {
  OUTPUT[sound] = M.multiply(OUTPUT[sound], OUTPUT_NORM / M.norm(OUTPUT[sound]))
}

var Manager = module.exports = function(opts) {
  var self = this;
  self.options = opts;

  self.neurons = [];

  for (var i = 0; i < NUM_NEURONS; ++i) {
    self.neurons.push(new Neuron(_.extend({
      port: PORTS.shift(),
      id: 'n' + i,
    }, NEURON_OPTS)))
  }

  self.samples = [
    {input: INPUT.quack, output: OUTPUT.duck, inputLabel: 'quack', outputLabel: 'duck'},
    {input: INPUT.bark, output: OUTPUT.dog, inputLabel: 'bark', outputLabel: 'dog'},
    {input: INPUT.oink, output: OUTPUT.pig, inputLabel: 'oink', outputLabel: 'pig'},
    {input: INPUT.neigh, output: OUTPUT.horse, inputLabel: 'neigh', outputLabel: 'horse'},
    {input: INPUT.woof, output: OUTPUT.dog, inputLabel: 'woof', outputLabel: 'dog'},
    {input: INPUT.snort, output: OUTPUT.pig, inputLabel: 'snort', outputLabel: 'pig'},
  ]
  if (MAX_SAMPLES) {
    self.samples = self.samples.filter(function(s, idx) { return idx < MAX_SAMPLES })
  }
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
  self.output = new Neuron(opts);

  for (var i = 0; i < self.neurons.length - 1; ++i) {
    self.connect(self.neurons[i], self.neurons[i+1])
  }
  self.outputNeuron = self.neurons[self.neurons.length - 1];
  self.subscribe(self.outputNeuron, self.output);
}

Manager.prototype.findClosestSample = function(data) {
  var lowest = 2.0;
  var closest = null;
  console.log('find closest', data._data);
  this.samples.forEach(function(s) {
    var dist = Neuron.getDistance(s.output, data);
    console.log('  ' + s.outputLabel, dist, s.output._data);
    if (dist < lowest) {
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
    var msg = testSample ? 'TESTING' : 'TRAINING';
    console.log('\n\n\n' + msg + ' ' + sample.inputLabel);
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

