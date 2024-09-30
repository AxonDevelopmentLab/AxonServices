const express = require('express');
const compression = require('compression');
const bodyParser = require('body-parser');
const cors = require("cors");

const app = express();
app.use(express.json({ limit: '1mb' }), express.urlencoded({ limit: '1mb', extended: true }), compression(), bodyParser.json(), cors());

const mongoose = require('mongoose')
mongoose.connect(process.env.mongoose, { useNewUrlParser: true, useUnifiedTopology: true });

const AccountService = require('./services/account.js');
const StatisticsService = require('./services/statistics.js');
const APPDownload = require('./services/appdownload.js');
const APPLogs = require('./services/applogs.js');
const DiscordSync = require('./services/discordsync.js');
const SystemSecurity = require('./services/security.js');
require('./services/background_cron.js')

app.get('/', (req, res) => {
  res.send({ status: 200 })
})

app.get('/lock_account', (req, res) => {
  res.send(`<body onload="window.close()"></body>`)
  const RequestIP = req.headers['x-forwarded-for']?.split(',').shift() || req.socket?.remoteAddress;
  if (req.query.account_token) {
    AccountService.lockAccount(RequestIP, req.query.account_token);
  }
})

app.get('/email_verification', (req, res) => {
  const RequestIP = req.headers['x-forwarded-for']?.split(',').shift() || req.socket?.remoteAddress;
  if (req.query.token) {
    AccountService.emailVerification(RequestIP, res, req.query.token);
  }
})

app.get('/connect_discord', (req, res) => {
  const RequestIP = req.headers['x-forwarded-for']?.split(',').shift() || req.socket?.remoteAddress;
  if (req.query.id && req.query.code) {
    DiscordSync.run(RequestIP, res, req.query.id, req.query.code);
  }
})

app.post('/account/edit', (req, res) => {
  const RequestIP = req.headers['x-forwarded-for']?.split(',').shift() || req.socket?.remoteAddress
  AccountService.edit(RequestIP, res, req.body);
})

app.post('/auth/login', (req, res) => {
  const RequestIP = req.headers['x-forwarded-for']?.split(',').shift() || req.socket?.remoteAddress
  AccountService.login(RequestIP, res, req.body);
})

app.post('/auth/register', (req, res) => {
  const RequestIP = req.headers['x-forwarded-for']?.split(',').shift() || req.socket?.remoteAddress
  AccountService.register(RequestIP, res, req.body);
})

app.post('/statistics/instalock', (req, res) => {
  const RequestIP = req.headers['x-forwarded-for']?.split(',').shift() || req.socket?.remoteAddress
  StatisticsService.instalock(RequestIP, req.body, res);
})

app.post('/logs/instalock', (req, res) => {
  const RequestIP = req.headers['x-forwarded-for']?.split(',').shift() || req.socket?.remoteAddress
  APPLogs.instalock(RequestIP, res, req.body);
})

app.post('/downloadService', (req, res) => {
    const RequestIP = req.headers['x-forwarded-for']?.split(',').shift() || req.socket?.remoteAddress
    APPDownload.get(RequestIP, res, req.body)
})

app.post('/sec/analysis', (req, res) => {
  const RequestIP = req.headers['x-forwarded-for']?.split(',').shift() || req.socket?.remoteAddress
  SystemSecurity.upload(RequestIP, res, req.body);
})

app.listen(8080, () => {
  console.log('[AxonLAB] Service is running.')
});
