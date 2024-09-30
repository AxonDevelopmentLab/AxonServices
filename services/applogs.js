const security = require("../background/security.js");
const axios = require('axios');

exports.instalock = async (UserIP, UserHTTP, Data) => {
  if (!Data.security) return UserHTTP.send({ status: 401 });
  if (!Data.logs?.account_token) return UserHTTP.send({ status: 401 });
  
  const secureEnviroment = security.check(Data.security);
  if (secureEnviroment) return UserHTTP.send({ status: 401 });
  
  Data.logs.UserIP = UserIP;

  axios.post(process.env.logsURL, Data, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.logsAUTH
    }
  }).catch((err) => {
    console.log(err)
  })
  
  return UserHTTP.send({ status: 200 });
};