const mongoose = require('mongoose');
const scheme = new mongoose.Schema({
  ID: String,
  TotalMatches: Number,
  SucessfullyMatches: Number,
  FreePicks: Number,
  Agents: Array
});

module.exports = mongoose.model('stats.instalock', scheme);