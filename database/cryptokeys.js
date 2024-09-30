const mongoose = require('mongoose');
const scheme = new mongoose.Schema({
  Service: String,
  LoggerKey: String,
  CryptographyKey: String,
  ScriptIVs: Array,
  AppIV: String
});

module.exports = mongoose.model('axonlab.cryptokeys', scheme);