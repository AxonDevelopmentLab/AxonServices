const accountScheme = require("../database/account");
exports.get = async (IP, UserHTTP, Body) => {
  const services = {
    "instalock": {
      requireLogin: true,
      url: "https://www.dropbox.com/scl/fi/3eadnwz9707gjoh04kvcx/InstalockAPP-Installer.exe?rlkey=n66f2nrzsi4s791aiyex1lvqc&st=j6ruopla&dl=1"
    },
    "axsc": {
      requireLogin: false,
      url: "https://www.dropbox.com/scl/fi/gh1676bseohd1cvofxyiy/AXSC.zip?rlkey=a2r0yyrrcmsd7wkp8cmjo10lk&st=j02f9rmk&dl=1"
    }
  };
  
  if (!Object.keys(services).includes(Body.service)) return UserHTTP.send({ status: 400 });
  const getService = services[Body.service];
  
  if (getService.requireLogin === true) {
    const getAccount = await accountScheme.findOne({ Token: Body.account_token });
    if (!getAccount) return UserHTTP.send({ status: 401 });
  }

  return UserHTTP.send({ status: 200, url: getService.url });
}
