var Express = require('express');
var Request = require('request');
var Async = require('async');
var M = require('mathjs');

var MAX_NORM = 10;
var DECAY_RATE = 1;
var EVOLVE_RATE = .3;
var EVOLVE_SCALE = .5;

var Neuron = module.exports = function(opts) {
  var self = this;
  this.options = opts;
  this.id = opts.id;
  this.io = opts.io;
  if (this.io) {
    this.io.refresh = this.io.refresh || 250;
    setInterval(function() {
      self.sendUpdate();
    }, self.io.refresh)
  }
  var dim = this.options.dimensions = this.options.dimensions || {};
  dim.hidden = dim.hidden || 10;
  this.setup();
  this.state = {
    history: {
      input: [],
      output: [],
    },
    subscribers: [],
    hidden: M.zeros(dim.hidden),
    bias: M.random([dim.hidden], -1, 1),
    transforms: {},
  };
  this.log('CREATED', this.options);
}

Neuron.prototype.sendUpdate = function() {
  var self = this;
  if (!self.io) return;
  var norm = M.norm(self.state.hidden);
  self.io.socket.emit('neuron', {
    id: self.id,
    transforms: self.getTransforms(),
    hidden: self.state.hidden._data,
    norm: norm,
    normalized: M.divide(self.state.hidden, norm)._data,
  })
}

Neuron.prototype.setup = function() {
  var self = this;
  var App = Express();
  App.use(require('body-parser').json());

  App.post('/:action', function(req, res) {
    res.end();
    if (req.body.signal) req.body.signal = M.matrix(req.body.signal);
    self[req.params.action](req.body);
  })
  App.listen(self.options.port);
  console.log('LISTENING', self.options.port);
  self.play();
}

Neuron.prototype.pause = function() {
  var self = this;
  clearTimeout(self.timeout);
  self.timeout = null;
}
Neuron.prototype.play = function() {
  if (this.timeout) return;
  this.setTimeout(this.options.interval);
}
Neuron.prototype.setTimeout = function(ms) {
  var self = this;
  if (!ms) return;
  self.timeout = setTimeout(function() {
    self.maybeFire();
  }, ms);
}

Neuron.prototype.subscribe = function(sub) {
  this.state.subscribers.push(sub);
}
Neuron.prototype.unsubscribe = function(id) {
  var self = this;
  self.state.subscribers = self.state.subscribers.filter(function(sub) {
    return sub.id !== id;
  })
}

Neuron.prototype.transform = function(input) {
  var self = this;
  var trans = self.state.transforms[input.id];
  if (!trans) {
    self.state.transforms[input.id] = trans =
            M.random([input.signal.size()[0], self.options.dimensions.hidden], -1, 1);
  }
  return M.add(M.multiply(input.signal, trans), self.state.bias);
}

Neuron.prototype.adjustTransform = function(input, transformed) {
  var self = this;
  input.distance = self.getDistance(transformed);
  if (input.distance === 0) return;
  var hiddenNorm = M.norm(self.state.hidden);
  var trans = self.state.transforms[input.id];
  var bias = self.state.bias;
  var maxTries = 20;
  var movementIncr = input.distance / maxTries;
  var newDist = input.distance + 1;
  var iter = 0;
  while(newDist >= input.distance) {
    if (iter++ > maxTries) {
      self.log('error', 'couldn\'t upgrade!')
      self.state.transforms[input.id] = trans;
      break;
    }
    var movement = movementIncr * iter;
    var adders = M.random(trans._size, -movement, movement);
    self.state.transforms[input.id] = M.add(trans, adders);
    //adders = M.random(bias._size, -movement, movement);
    //self.state.bias = M.add(bias, adders);
    newDist = self.getDistance(self.transform(input));
  } 
}

Neuron.getDistance = function(v1, v2) {
  var dot = M.dot(v1, v2)
  var norm1 = M.norm(v1);
  var norm2 = M.norm(v2);
  if (norm1 === 0 || norm2 === 0) return 0;
  var sim = dot / (norm1 * norm2);
  var dist = -1 * sim;
  return (dist + 1) / 2;
}

Neuron.prototype.getDistance = function(vec) {
  if (M.norm(vec) === 0.0) return 1.0;
  return Neuron.getDistance(vec, this.state.hidden);
}

Neuron.prototype.signal = function(input) {
  var self = this;
  var startTime = (new Date()).getTime();
  input.norm = M.norm(input.signal);
  self.log('signal from', input.id)
  if (self.io) {
    self.io.socket.emit('signal', {
      from: input.id,
      to: self.id,
      signal: input.signal._data,
    })
  }
  if (self.state.history.input.length > self.options.maxHistory) {
    self.state.history.input.shift();
  }
  var state = self.transform(input);

  if (!self.state.holding) {
    if (self.id !== 'output') self.log('update', self.state.hidden._data, state._data);
    self.evolve(state);
  }

  self.adjustTransform(input, state);
  self.state.history.input.push(input);
  if (self.state.holding) self.log('dist', input.distance);
  var endTime = (new Date()).getTime();
  var time = endTime - startTime;
  if (time > 10) self.log('time', 'signal:', endTime - startTime)
}

Neuron.prototype.evolve = function(state) {
  var self = this;
  var stateNorm = M.norm(state);
  var hiddenNorm = M.norm(self.state.hidden);
  var stateNormalized = stateNorm === 0 ? state : M.divide(state, stateNorm);
  var rate = EVOLVE_RATE;
  var hiddenNormalized = hiddenNorm === 0 ? self.state.hidden : M.divide(self.state.hidden, hiddenNorm);
  var distance = Neuron.getDistance(hiddenNormalized, stateNormalized);
  var contribHidden = M.multiply(hiddenNormalized, 1 - rate);
  var contribState = M.multiply(stateNormalized, rate);
  var scale = hiddenNorm - (distance * 2 - 1) * EVOLVE_SCALE;
  self.state.hidden = M.multiply(M.add(contribHidden, contribState), Math.max(.1, scale));
}

Neuron.prototype.hold = function(input) {
  var self = this;
  self.state.holding = input.id;
  self.state.hidden = input.signal;
  self.log('holding', self.state.hidden);
}

Neuron.prototype.release = function() {
  this.state.holding = false;
}

Neuron.prototype.probe = function(input) {
  var self = this;
  var state = self.transform(input);
  var dist = self.getDistance(state);
  return dist;
}

Neuron.prototype.fire = function(signal, callback) {
  var self = this;
  this.state.history.output.push(signal);
  if (this.state.history.output.length > this.options.maxHistory) {
    this.state.history.output.shift();
  }
  self.log('fire', self.state.subscribers.length);
  Async.parallel(self.state.subscribers.map(function(sub) {
    return function(acb) {
      var translated = signal;
      Request.post(sub.location + '/signal', {
        timeout: 1600,
        json: {id: self.options.id, signal: translated._data},
      }, function(err) {
        if (err) err.to = sub.id;
        acb(err);
      });
    }
  }), function(err) {
    if (err) self.log('error', 'fire to:' + err.to, err);
    if (callback) callback();
  })
}

Neuron.prototype.maybeFire = function(callback) {
  var self = this;
  var norm = M.norm(self.state.hidden);
  var nextFire = self.options.interval;
  var decayAndReset = function() {
    if (!self.state.holding && norm > DECAY_RATE) self.state.hidden = M.multiply(self.state.hidden, (norm - DECAY_RATE) / norm);
    self.setTimeout(nextFire);
    if (callback) callback();
  }
  self.log('maybefire', norm);
  if (norm > 1.0) {
    if (norm > MAX_NORM) {
      self.state.hidden = M.multiply(self.state.hidden, MAX_NORM / norm);
      norm = MAX_NORM;
    }
    nextFire = nextFire / norm;
    self.fire(M.tanh(M.divide(self.state.hidden, MAX_NORM)), decayAndReset);
  } else {
    decayAndReset();
  }
}

Neuron.prototype.log = function(label) {
  var self = this;
  if (!global.verbose && !self.options.verbose) {
    if (!global.log) return;
    if (global.log.indexOf(label) === -1) return;
  };
  var args = Array.prototype.slice.call(arguments);
  args.unshift('    ' + this.id);
  console.log.apply(console, args)
}

Neuron.prototype.logHistory = function() {
  var self = this;
  self.log('history', self.state.history.input.map(function(h) {return {s: h.signal._data, d: h.distance}}));
}

Neuron.prototype.getTransforms = function() {
  var transforms = {};
  var self = this;
  for (var id in self.state.transforms) {
    transforms[id] = self.state.transforms[id]._data;
  }
  return transforms;
}
