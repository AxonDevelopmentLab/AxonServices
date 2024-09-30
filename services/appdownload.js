const accountScheme = require("../database/account");
exports.get = async (IP, UserHTTP, Body) => {
  const services = {
    "instalock": "https://www.dropbox.com/scl/fi/790v1bd70tcg5pk85crlu/InstalockAPP-v1.0.3.zip?rlkey=kskgyqpgjdr9ecl6rr3267bib&st=nh3466dc&dl=1",
    "axsc": "https://www.dropbox.com/scl/fi/rjera2mkfx9l0muidem2u/AXSC-1.0.1.zip?rlkey=df5kbrkauxvsixx6a23u2ejdq&st=6riyiodj&dl=1"
  };
  
  if (!Object.keys(services).includes(Body.service)) return UserHTTP.send({ status: 400 });
  
  const getAccount = await accountScheme.findOne({ Token: Body.account_token });
  if (!getAccount) return UserHTTP.send({ status: 401 });
  
  return UserHTTP.send({ status: 200, url: services[Body.service] });
}