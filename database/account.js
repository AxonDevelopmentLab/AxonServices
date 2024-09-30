const mongoose = require('mongoose');
const scheme = new mongoose.Schema({
    ID: String,
    Token: String,
    Username: String,
    Password: String,
    OwnerIP: String,
    Plan: Number,
    Email: String,
    isBlocked: String,
    PlanExpiresIn: String,
    accountDeleteIn: String,
    Devices: Array,
    RateLimit: Number,
    Connections: Object
});

module.exports = mongoose.model('accounts', scheme);