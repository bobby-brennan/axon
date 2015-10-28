var _ = require('lodash');
var GenId = require('shortid').generate;
var M = require('mathjs');

var Neuron = require('./neuron.js');

var MAX_SAMPLES = 2;
var NUM_NEURONS = 2;

var NEURON_OPTS = {
  maxHistory: 3,
  interval: 250,
  dimensions: {hidden: 6},
}

var CONST_OPTS = {
  dimensions: {hidden: 2},
}

var OUT_OPTS = {
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
var OUTPUT_NORM = 10;
for (var sound in INPUT) {
  INPUT[sound] = M.multiply(INPUT[sound], INPUT_NORM / M.norm(INPUT[sound]))
}
for (var sound in OUTPUT) {
  OUTPUT[sound] = M.multiply(OUTPUT[sound], OUTPUT_NORM / M.norm(OUTPUT[sound]))
}

var Manager = module.exports = function(opts) {
  var self = this;
  self.options = opts;
  self.io = {socket: opts.socket};

  self.neurons = [];

  for (var i = 0; i < NUM_NEURONS; ++i) {
    var ext = i === NUM_NEURONS - 1 ? OUT_OPTS : {};
    self.neurons.push(new Neuron(_.extend({
      io: self.io,
      port: PORTS.shift(),
      id: 'n' + i,
    }, NEURON_OPTS, ext)))
  }

  self.trainingSamples = [
    {input: INPUT.quack, output: OUTPUT.duck, inputLabel: 'quack', outputLabel: 'duck'},
    {input: INPUT.bark, output: OUTPUT.dog, inputLabel: 'bark', outputLabel: 'dog'},
    {input: INPUT.oink, output: OUTPUT.pig, inputLabel: 'oink', outputLabel: 'pig'},
    {input: INPUT.neigh, output: OUTPUT.horse, inputLabel: 'neigh', outputLabel: 'horse'},
    {input: INPUT.woof, output: OUTPUT.dog, inputLabel: 'woof', outputLabel: 'dog'},
    {input: INPUT.snort, output: OUTPUT.pig, inputLabel: 'snort', outputLabel: 'pig'},
  ]
  if (MAX_SAMPLES) {
    self.trainingSamples = self.trainingSamples.filter(function(s, idx) { return idx < MAX_SAMPLES })
  }

  self.inputNeuron = new Neuron(_.extend({
    id: 'input',
    io: self.io,
    port: PORTS.shift(),
  }, NEURON_OPTS, CONST_OPTS));

  for (var i = 0; i < self.neurons.length - 1; ++i) {
    self.connect(self.neurons[i], self.neurons[i+1])
  }
  self.subscribe(self.inputNeuron, self.neurons[0]);
  self.outputNeuron = self.neurons[self.neurons.length - 1];
  var allNeurons = [self.inputNeuron].concat(self.neurons).map(function(neuron) {
    return {id: neuron.id};
  });
  self.io.socket.emit('neurons', {
    neurons: allNeurons,
  })
  self.log('NEURONS', allNeurons);
}

Manager.prototype.log = function() {
  var self = this;
  if (!global.verbose && !global.log) return;
  var args = Array.prototype.slice.call(arguments);
  args.unshift('manager');
  console.log.apply(console, args)
}

Manager.prototype.findClosestSample = function(data) {
  var lowest = 2.0;
  var closest = null;
  var self = this;
  self.log('find closest', data._data);
  this.trainingSamples.forEach(function(s) {
    var dist = Neuron.getDistance(s.output, data);
    self.log('  ' + s.outputLabel, dist, s.output._data);
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

Manager.prototype.train = function(iterations, msPerIteration, done) {
  this.test(iterations, msPerIteration, null, done);
}

Manager.prototype.test = function(iterations, msPerIteration, testSample, done) {
  var self = this;
  self.inputNeuron.play();
  var runIteration = function() {
    var sample = testSample;
    if (!sample) {
      var sampleIdx = Math.floor(self.trainingSamples.length * Math.random());
      sample = self.trainingSamples[sampleIdx];
    }
    var msg = testSample ? 'TESTING' : 'TRAINING';
    self.log('\n\n\n' + msg + ' ' + sample.inputLabel);
    self.inputNeuron.hold({id: 'INPUT', signal: testSample ? M.multiply(sample.input, 6) : sample.input})
    if (!testSample) self.outputNeuron.hold({id: 'TRAIN', signal: sample.output});
  }
  var interval = setInterval(runIteration, msPerIteration);
  runIteration();

  setTimeout(function() {
    self.log('DONE');
    self.inputNeuron.release();
    self.outputNeuron.release();
    clearInterval(interval);
    if (testSample) {
      var curState = self.outputNeuron.state.hidden;
      var closest = self.findClosestSample(curState);
      self.log('CLASSIFIED', testSample.inputLabel, 'as', closest.outputLabel);
      self.io.socket.emit('result', {
        input: testSample.inputLabel,
        output: closest.outputLabel,
        distance: Neuron.getDistance(curState, closest.output)
      });
    }
    if (done) done();
  }, msPerIteration * iterations);
}

