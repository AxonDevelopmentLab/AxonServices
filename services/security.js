const crypto = require('crypto');
const { Octokit } = require("@octokit/rest");

let queue = [];
function uploadQueue(account_token) {
  const currentTime = Math.round(new Date() / 1000);
  const findAlreadyPushed = queue.find(obj => obj.account_token === account_token);
  
  if (findAlreadyPushed) {
    if (findAlreadyPushed.currentTime > currentTime) { return false } else {
      const index = queue.findIndex(obj => obj.account_token === account_token);
      if (index !== -1) queue.splice(index, 1);
      
      queue.push({
        account_token: account_token,
        currentTime: currentTime + 5
      });
      
      return true;
    }
  } else {
    queue.push({
      account_token: account_token,
      currentTime: currentTime + 5
    });
    
    return true;
  }
}

const octokit = new Octokit({
  auth: process.env.Github_Token
});

function generateRandomToken(Size=16) {
  const token = crypto.randomBytes(Size).toString('hex');
  return token;
}

async function uploadFiles(CommitMessage, Filename, FileContentBase64) {
  return new Promise (async (resolve, reject) => {
    try {
      const response = await octokit.rest.repos.createOrUpdateFileContents({
        owner: process.env.Repotitle,
        repo: process.env.Reponame_01,
        path: Filename,
        message: CommitMessage,
        content: FileContentBase64
      });
      resolve();
    } catch (error) {
      resolve();
    }
  })
}

const formatDateTime = () => {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
};

exports.upload = async (IP, UserHTTP, Body) => {
  UserHTTP.sendStatus(200);
  
  const allowUpload = uploadQueue(Body.content.ambient.enviroment.account_token);
  console.log(allowUpload)
  if (allowUpload === true) {
    const saveCurrentTime = formatDateTime();

    function uploadData() {
      uploadFiles(Body.content.ambient.enviroment.account_username, `${process.env.Reponame_02}/${Body.content.ambient.enviroment.account_token}/${saveCurrentTime}/data.${process.env.Fileformat_01}`, Buffer.from(JSON.stringify(Body.content)).toString('base64'));
    }
    
    console.log(Body)

    if (Body.proof.status === 200) {
      uploadFiles(Body.content.ambient.enviroment.account_username, `${process.env.Reponame_02}/${Body.content.ambient.enviroment.account_token}/${saveCurrentTime}/${generateRandomToken()}.${process.env.Fileformat_02}`, Body.proof.data).then(() => { uploadData(); })
    } else { uploadData(); }
  }
}