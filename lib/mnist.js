var _ = require('lodash');
var GenId = require('shortid').generate;
var M = require('mathjs');

var Neuron = require('./neuron.js');
var Util = require('./mnist-util.js');

var MNIST = require('mnist').set(1000, 50);
var MAX_SAMPLES = 2;
var filterSamples = function(s) {
  for (var i = 0; i < MAX_SAMPLES; ++i) if (s.output[i]) return true;
  return false;
}
var resizeSamples = function(s) {
  s.output = s.output.slice(0, MAX_SAMPLES);
}
MNIST.training = MNIST.training.filter(filterSamples);
MNIST.test = MNIST.test.filter(filterSamples);
MNIST.training.forEach(resizeSamples);
MNIST.test.forEach(resizeSamples);

var NEURON_OPTS = {
  maxHistory: 3,
  interval: 250,
  dimensions: {hidden: 10},
}
var INPUT_OPTS = {
  dimensions: {hidden: 9},
}
var OUTPUT_OPTS = {
  dimensions: {hidden: MAX_SAMPLES},
}

var PORTS = [];
for (var i = 3001; i < 4000; ++i) PORTS.push(i);

var Manager = module.exports = function(opts) {
  var self = this;
  self.options = opts;
  self.io = {socket: opts.socket, refresh: 1000};

  self.trainingSamples = MNIST.training;
  self.testSamples = MNIST.test;

  self.classes = [];
  for (var i = 0; i < MAX_SAMPLES; ++i) {
    var digitClass = {
      label: i,
      value: [],
    }
    for (var j = 0; j < MAX_SAMPLES; ++j) {
      digitClass.value.push(0);
    }
    digitClass.value[i] = 1;
    digitClass.value = M.matrix(digitClass.value);
    self.classes.push(digitClass);
  }

  self.outputNeuron = new Neuron(_.extend({
    id: 'output',
    io: self.io,
    port: PORTS.shift(),
  }, NEURON_OPTS, OUTPUT_OPTS))

  self.inputNeurons = [];
  for (var row = 0; row < 9; ++row) {
    for (var col = 0; col < 9; ++col) {
      self.inputNeurons.push(new Neuron(_.extend({
        id: 'in_r' + row + 'c' + col,
        io: self.io,
        port: PORTS.shift(),
      }, NEURON_OPTS, INPUT_OPTS)))
    }
  }

  var layer1 = [];
  for (var row = 0; row < 3; ++row) {
    for (var col = 0; col < 3; ++col) {
      var neuron = new Neuron(_.extend({
        id: 'l1_r' + row + 'c' + col,
        io: self.io,
        port: PORTS.shift(),
      }, NEURON_OPTS));
      layer1.push(neuron);
      var connectIndices = Util.getChunkIndices(9, 3, row, col);
      connectIndices.forEach(function(idx) {
        self.subscribe(self.inputNeurons[idx], neuron);
      })
      self.connect(neuron, self.outputNeuron);
    }
  }
  var neurons = self.inputNeurons.concat(layer1);
  neurons.push(self.outputNeuron);
  self.io.socket.emit('neurons', {
    neurons: neurons.map(function(n) {return {id: n.id}})
  });
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
  this.classes.forEach(function(s) {
    var dist = Neuron.getDistance(s.value, data);
    self.log('  ' + s.label, dist, s.value._data);
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
  var runIteration = function() {
    var sample = testSample;
    if (!sample) {
      var sampleIdx = Math.floor(self.trainingSamples.length * Math.random());
      sample = self.trainingSamples[sampleIdx];
    }
    var msg = testSample ? 'TESTING' : 'TRAINING';
    self.log('\n\n\n' + msg + ' ' + sample.output);
    var chunks = Util.chunkImage(sample.input);
    chunks.forEach(function(c, idx) {
      self.inputNeurons[idx].hold({id: 'INPUT', signal: M.multiply(M.matrix(c), 6)});
    })
    if (!testSample) self.outputNeuron.hold({id: 'TRAIN', signal: M.multiply(M.matrix(sample.output), 10)});
  }
  var interval = setInterval(runIteration, msPerIteration);
  runIteration();

  setTimeout(function() {
    self.log('DONE');
    clearInterval(interval);
    self.inputNeurons.forEach(function(n) {n.release()})
    self.outputNeuron.release();
    if (testSample) {
      var curState = self.outputNeuron.state.hidden;
      var closest = self.findClosestSample(curState);
      var classification = {
        input: testSample.output,
        output: closest.label,
        distance: Neuron.getDistance(curState, closest.value)
      }
      self.log('CLASSIFIED', classification);
      self.io.socket.emit('result', classification);
    }
    if (done) done();
  }, msPerIteration * iterations);
}

