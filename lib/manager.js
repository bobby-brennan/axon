var _ = require('lodash');
var GenId = require('shortid').generate;

var Neuron = require('./neuron.js');

var NEURON_OPTS = {
  maxHistory: 3,
  interval: 1000,
  dimensions: {hidden: 2},
}

var PORTS = [];
for (var i = 3001; i < 4000; ++i) PORTS.push(i);

var NUM_NEURONS = 2;

var Manager = module.exports = function(opts) {
  var self = this;
  self.options = opts;

  self.neurons = [];

  for (var i = 0; i < NUM_NEURONS; ++i) {
    self.neurons.push(new Neuron(_.extend({
      port: PORTS.shift(),
      id:i,
    }, NEURON_OPTS)))
  }
  self.neurons[0].state.subscribers.push({location: 'http://127.0.0.1:' + self.neurons[1].options.port})
  var train = function() {
    self.neurons[0].signal({id: 'INPUT', signal: [[.1, .1, .1]]});
    self.neurons[1].signal({id: 'OUTPUT', signal: [[.9, .9, .9]]});
    printHist('n0', self.neurons[0]);
    printHist('n1', self.neurons[1]);
  }
  var interval = setInterval(train, NEURON_OPTS.interval / 4);
  setInterval(function() {
    clearInterval(interval);
    console.log('------done training-----')
    printHist('n0', self.neurons[0]);
    printHist('n1', self.neurons[1]);
    console.log('hid', self.neurons[1].state.hidden);
    console.log('hid', JSON.stringify(self.neurons[1].state.transforms, null, 2));
    console.log('probe', self.neurons[1].probe({id: 'OUTPUT', signal: [[.9, .9, .9]]}))
    setTimeout(function() {
      interval = setInterval(train, NEURON_OPTS.interval / 4);
    }, 3000)
  }, NEURON_OPTS.interval * 50 / 4)
}

var printHist = function(label, neuron) {
  console.log(label, neuron.state.history.input.map(function(h) {return {s: h.signal._data[0], d: h.distance}}));
}
