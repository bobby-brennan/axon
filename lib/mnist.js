var _ = require('lodash');
var GenId = require('shortid').generate;
var M = require('mathjs');

var Neuron = require('./neuron.js');

var MNIST = require('mnist').set(10, 10);

var NEURON_OPTS = {
  maxHistory: 3,
  interval: 250,
  dimensions: {hidden: 10},
}
var INPUT_OPTS = {
  dimensions: {hidden: 784},
}
var OUTPUT_OPTS = {
  dimensions: {hidden: 10},
}

var PORTS = [];
for (var i = 3001; i < 4000; ++i) PORTS.push(i);

var makeMatrix = function(d) {
  return {
    input: M.matrix(d.input),
    output: M.matrix(d.output),
  }
}

var Manager = module.exports = function(opts) {
  var self = this;
  self.options = opts;
  self.io = {socket: opts.socket};

  self.testSamples = MNIST.test.map(makeMatrix);
  self.trainSamples = MNIST.training.map(makeMatrix);
  self.classes = [];
  for (var i = 0; i < 10; ++i) {
    var digitClass = {
      label: i,
      value: [0,0,0,0,0,0,0,0,0,0],
    }
    digitClass.value[i] = 1;
    self.classes.push(digitClass);
  }

  self.inputNeuron = new Neuron(_.extend({
    id: 'input',
    io: self.io,
    port: PORTS.shift(),
  }, NEURON_OPTS, INPUT_OPTS));

  self.outputNeuron = new Neuron(_.extend({
    id: 'output',
    io: self.io,
    port: PORTS.shift(),
  }, NEURON_OPTS, OUTPUT_OPTS))

  var neurons = [self.inputNeuron];

  // First layer
  for (var i = 0; i < 10; ++i) {
    var neuron = new Neuron(_.extend({
      id: 'l1n' + i,
      io: self.io,
      port: PORTS.shift(),
    }, NEURON_OPTS))
    self.connect(self.inputNeuron, neuron);
    self.connect(self.outputNeuron, neuron);
    neurons.push(neuron);
  }
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
    self.log('  ' + s.label, dist, s.output._data);
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
      var sampleIdx = Math.floor(self.trainSamples.length * Math.random());
      sample = self.trainSamples[sampleIdx];
    }
    var msg = testSample ? 'TESTING' : 'TRAINING';
    self.log('\n\n\n' + msg + ' ' + sample.output);
    self.inputNeuron.hold({id: 'INPUT', signal: testSample ? M.multiply(sample.input, 6) : sample.input})
    if (!testSample) self.outputNeuron.hold({id: 'TRAIN', signal: M.multiply(sample.output, 10)});
  }
  var interval = setInterval(runIteration, msPerIteration);
  runIteration();

  setTimeout(function() {
    self.log('DONE');
    self.inputNeuron.pause();
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
    self.outputNeuron.release();
    if (done) done();
  }, msPerIteration * iterations);
}

