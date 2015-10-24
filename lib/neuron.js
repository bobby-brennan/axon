var Express = require('express');
var Request = require('request');
var Async = require('async');
var M = require('mathjs');

var Neuron = module.exports = function(opts) {
  this.options = opts;
  this.options.interval = this.options.interval || 1000;
  var dim = this.options.dimensions = this.options.dimensions || {};
  dim.hidden = dim.hidden || 10;
  this.setup();
  this.state = {
    history: {
      input: [],
      output: [],
    },
    subscribers: [],
    hidden: M.ones(1, dim.hidden),
    transforms: {},
  };
}

Neuron.prototype.setup = function() {
  var self = this;
  var App = Express();
  App.use(require('body-parser').json());

  App.post('/:action', function(req, res) {
    self[req.params.action](req.body);
    res.end();
  })
  App.listen(self.options.port);
  self.timeout = setInterval(function() {
    self.maybeFire();
  }, self.options.interval);
}

Neuron.prototype.subscribe = function(sub) {
  self.state.subscribers.push(sub);
}

Neuron.prototype.signal = function(input) {
  var self = this;
  input.signal = M.matrix(input.signal);
  if (self.state.history.input.length > self.options.maxHistory) {
    self.state.history.input.shift();
  }
  var trans = self.state.transforms[input.id] =
      self.state.transforms[input.id] || M.ones(input.signal.size()[1], self.options.dimensions.hidden);
  var state = M.multiply(input.signal, trans);
  var dist = M.sum(M.square(M.subtract(state, self.state.hidden)));
  var contribState = M.dotMultiply(state, .1);
  var contribHidden = M.dotMultiply(self.state.hidden, .9);
  self.state.hidden = M.add(contribState, contribHidden);
  input.distance = dist;
  self.state.history.input.push(input);

  var movement = Math.min(1, dist);
  var adders = M.random(trans._size, -movement, movement);
  self.state.transforms[input.id] = M.add(trans, adders);
}

Neuron.prototype.probe = function(input) {
  var self = this;
  input.signal = M.matrix(input.signal);
  var trans = self.state.transforms[input.id] =
      self.state.transforms[input.id] || M.ones(input.signal.size()[1], self.options.dimensions.hidden);
  var state = M.multiply(input.signal, trans);
  var dist = M.sum(M.square(M.subtract(state, self.state.hidden)));
  return dist;
}

Neuron.prototype.fire = function(signal, callback) {
  var self = this;
  this.state.history.output.push(signal);
  if (this.state.history.output.length > this.options.maxHistory) {
    this.state.history.output.shift();
  }
  Async.parallel(self.state.subscribers.map(function(sub) {
    return function(acb) {
      Request.post(sub.location + '/signal', {
        json: {id: self.options.id, signal: signal},
      }, acb);
    }
  }), function(err) {
    if (err) throw err;
    if (callback) callback();
  })
}

Neuron.prototype.maybeFire = function(callback) {
  var self = this;
  self.fire(self.state.hidden._data, callback);
}




