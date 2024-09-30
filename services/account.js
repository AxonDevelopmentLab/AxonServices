const accountScheme = require("../database/account");
const security = require("../background/security.js");
const statisticsScheme = require("../database/instalock");
const serviceSchemes = require(`../database/cryptokeys.js`);
const nodemailer = require('nodemailer');
const validator = require('validator');
const crypto = require("crypto");
const planServices = require('../plan_services.json');

const EmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'contact.axonlab@gmail.com',
    pass: process.env.GoogleAuth
  }
});
const allServices = [
  {
    scheme: statisticsScheme,
    object: (ID) => {
      return {
        ID: ID,
        TotalMatches: 0,
        SucessfullyMatches: 0,
        FreePicks: 5,
        Agents: []
      }
    }
  }
]

function passwordCrypt(password) {
  const cipher = crypto.createCipher("aes-256-ecb", password);
  let encrypted = cipher.update(password, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

exports.subservices = async (Type, ID) => {
  if (Type === 'create') {
    for (const Service of allServices) {
      const getScheme = Service.scheme;
      const createTemplate = new getScheme(Service.object(ID));
      createTemplate.save();
    }
  } else if (Type === 'delete') {
    for (const Service of allServices) {
      const getScheme = Service.scheme;
      const getDatabase = await getScheme.findOne({ ID: ID });
      if (getDatabase) await statisticsScheme.findOneAndDelete({ ID: ID });
    }
  }
}

exports.login = async (UserIP, UserHTTP, Data) => {
  let bypass_block = false;
  let callback = {
    status: 200,
  };
  
  console.log(Data)

  async function authApproved(Account) {
    let updatedDevices = Account.Devices;
    updatedDevices.push(UserIP);
    
    await accountScheme.findOneAndUpdate({ ID: Account.ID }, {
      Devices: updatedDevices.filter((item, index) => updatedDevices.indexOf(item) === index)
    });
    
    const services = {
      "account": () => {
        callback.account = {
          id: Account.ID,
          token: Account.Token,
          username: Account.Username,
          email: Account.Email,
          plan: Account.Plan,
          connections: Account.Connections || {},
        };
      },
      "instalock_acess": async () => {
        if (!Data.security) { bypass_block = true; return; }
        if (Account.Email === "false") return UserHTTP.send({ status: 400, message: { text: "Vincule e verifique um e-mail para acessar acessar o Instalock.", color: "red" } });

        const secureEnviroment = security.check(Data.security);
        if (secureEnviroment) { bypass_block = true; return; }
        
        const getService = await serviceSchemes.findOne({ Service: "instalock" });
        callback.instalock_acess = {
          key: getService.CryptographyKey,
          ivs: getService.ScriptIVs
        }
      },
      "instalock_statistics": async () => {
        const getStatistics = await statisticsScheme.findOne({ ID: Account.ID });
        
        const recreateStatistics = {
          free_picks: getStatistics.FreePicks,
          matches: {
            sucess: getStatistics.SucessfullyMatches,
            failed: getStatistics.TotalMatches - getStatistics.SucessfullyMatches
          },
          agents: getStatistics.Agents
        }
        
        if (Account.Plan !== 0) recreateStatistics.free_picks = -1;
        callback.instalock_statistics = recreateStatistics;
      }
    };
    if (Account.isBlocked !== 'false') return UserHTTP.send({ status: 400, message: { text: "A sua conta está bloqueada.", color: "red" } });

    if (Data.getdata) {
      try {
        let break_parse = false;
        for (const service of Data.getdata) {
          if (break_parse) continue;
          if (planServices[service] && planServices[service] > Account.Plan) {
            break_parse = true;
            return UserHTTP.send({ status: 400, message: { text: `Você não tem acesso ao serviço "${service}"`, color: 'red' }});
          }
          
          await services[service]();
        };
        
        if (bypass_block) return UserHTTP.send({ status: 400, message: { text: "Login cancelado.", color: "red" }});
        if (!break_parse) return UserHTTP.send(callback);
      } catch (err) {
        return UserHTTP.send({ status: 400, message: { text: "Dados inválidos.", color: "red" } });
      }
    } else {
      return UserHTTP.send(callback);
    }
  }
  
  if (Data.raw) {
    if (!Data.token) return UserHTTP.send({ status: 400, message: { text: "Dados inválidos.", color: "red" }});

    const getAccount = await accountScheme.findOne({ Token: Data.token });
    if (!getAccount) return UserHTTP.send({ status: 400, message: { text: "Sessão expirada.", color: "red" }});
    if (!validator.isEmail(getAccount.Email)) return UserHTTP.send({ status: 400, message: { text: "O seu e-mail não está verificado.", color: "red" }});
    
    authApproved(getAccount);
  } else {
    if (!Data.email) return UserHTTP.send({ status: 400, message: { text: "Dados inválidos.", color: "red" }});
    if (!Data.password) return UserHTTP.send({ status: 400, message: { text: "Dados inválidos.", color: "red" }});

    const getAccount = await accountScheme.findOne({ Email: Data.email });
    if (!getAccount) return UserHTTP.send({ status: 400, message: { text: "A sua conta não existe ou não está verificada.", color: "red" }});
    
    if (getAccount.RateLimit >= 5) {
      setTimeout(async () => {
        const regetAccount = await accountScheme.findOne({ ID: getAccount.ID });
        if (regetAccount.RateLimit >= 5) await accountScheme.findOneAndUpdate({ ID: getAccount.ID }, { RateLimit: 0 });
      }, (1000 * 60 * 5))
      
      return UserHTTP.send({ status: 400, message: { text: "Aguarde 5 minutos para tentar novamente.", color: "red" }});
    };
    
    if (getAccount.Password !== passwordCrypt(Data.password)) {
      await accountScheme.findOneAndUpdate({ ID: getAccount.ID }, { RateLimit: (getAccount.RateLimit + 1) });
      return UserHTTP.send({ status: 400, message: { text: "Email ou senha incorretos.", color: "red" }});
    }
    
    await accountScheme.findOneAndUpdate({ ID: getAccount.ID }, { RateLimit: 0 });
    authApproved(getAccount);
  };
}

exports.register = async (UserIP, UserHTTP, Data) => {
  const password = Data.password.replaceAll(' ', '');
  const username = Data.username.replaceAll(' ', '');
  const email = Data.email;
  
  if (!validator.isEmail(email)) return UserHTTP.send({ status: 400, message: { text: 'Endereço de e-mail inválido.', color: 'red' }});
  const acceptedProvetors = ['gmail.com', 'protonmail.com', 'proton.me', 'pm.me', "outlook.com", "hotmail.com", "icloud.com", "live.com"];
  if (!acceptedProvetors.includes(email.split('@')[1])) return UserHTTP.send({ status: 400, message: { text: 'Esse provedor de e-mail não é aceito.', color: 'red' }});
  
  if (!username) return UserHTTP.send({ status: 400, message: { text: 'Preencha o nome de usuário.', color: 'red' }});
  if (!password) return UserHTTP.send({ status: 400, message: { text: 'Preencha a senha.', color: 'red' }});
  if (!Data.confirm_password) return UserHTTP.send({ status: 400, message: { text: 'Senhas não batem.', color: 'red' }});
  
  if (typeof Data.username !== 'string') return UserHTTP.send({ status: 400, message: { text: 'Dados inválidos.', color: 'red' }});
  if (typeof Data.password !== 'string') return UserHTTP.send({ status: 400, message: { text: 'Dados inválidos.', color: 'red' }});
  
  if (!validator.isLength(username, { min: 4, max: 16 })) return UserHTTP.send({ status: 400, message: { text: 'Nome de usuário com tamanho não permitido.', color: 'red' }});
  if (!validator.matches(username, /^[a-zA-Z0-9]+$/)) return UserHTTP.send({ status: 400, message: { text: 'Nome de usuário com caracteres não permitido.', color: 'red' }});
  
  if (password.length < 8) return UserHTTP.send({ status: 400, message: { text: 'Senha muito curta.', color: 'red' }});
  if (password.length > 32) return UserHTTP.send({ status: 400, message: { text: 'Senha muito longa.', color: 'red' }});
  
  if (password !== Data.confirm_password) return UserHTTP.send({ status: 400, message: { text: 'As senhas não batem.', color: 'red' }}); 
  
  const checkAlternativeAccount = await accountScheme.findOne({ OwnerIP: UserIP });
  if (checkAlternativeAccount) return UserHTTP.send({ status: 400, message: { text: 'Você não pode ter duas contas.', color: 'red' }})
  
  const checkEmailAlreadyExists = await accountScheme.findOne({ Username: username });
  if (checkEmailAlreadyExists) return UserHTTP.send({ status: 400, message: { text: 'Já existe uma conta com esse email.', color: 'red' }})
  
  const checkAccountAlreadyExistent = await accountScheme.findOne({ Username: username });
  if (checkAccountAlreadyExistent) return UserHTTP.send({ status: 400, message: { text: 'Já existe uma conta com esse nome.', color: 'red' }})
  
  function generateTokenFromEmail(Email, AccountID) {
    function encryptText(text, key) {
        const cipher = crypto.createCipheriv('aes-256-ecb', Buffer.from(key, 'hex'), null); // Null IV
        let encrypted = cipher.update(text, 'utf-8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    const createData = JSON.stringify({
        email: Email,
        junkdata: crypto.randomBytes(16).toString('hex')
    });

    const createToken = encryptText(createData, AccountID)
    return createToken;
}
  
  const AccountID = crypto.randomBytes(32).toString('hex');
  const EmailVerificationToken = generateTokenFromEmail(Data.email, AccountID);
  const createAccount = new accountScheme({
    ID: AccountID,
    Token: crypto.randomBytes(32).toString('hex'),
    Username: username,
    Password: passwordCrypt(password),
    OwnerIP: UserIP,
    Plan: 0,
    Email: EmailVerificationToken,
    isBlocked: 'false',
    PlanExpiresIn: 'false',
    accountDeleteIn: 'false',
    Devices: [`${UserIP}`],
    RateLimit: 0
  });
  
  const Options = {
    from: 'contact.axonlab@gmail.com',
    to: Data.email,
    subject: 'AxonLab — Verificar a sua Conta',
    text: `Acesse o link abaixo para verificar a sua conta.\nhttps://axonlab.glitch.me/account/verify?token=${EmailVerificationToken}\n\nCaso a sua conta não seja verificada em até 5 minutos, ela será apagada.\n\nObrigado por escolher a AxonLab!\n\nAtenciosamente,\nEquipe de Desenvolvimento da AxonLab.`
  };

  EmailTransporter.sendMail(Options, function(error, info){
    if (error) return UserHTTP.send({ status: 400, message: { text: 'Tente novamente mais tarde.', color: 'red' }});
            
    setTimeout(async () => {
      const regetAccount = await accountScheme.findOne({ ID: AccountID });
      if (!regetAccount) return;
      if (!validator.isEmail(regetAccount.Email)) {
        await accountScheme.findOneAndDelete({ ID: AccountID });
      }
    }, (1000 * 60) * 5);
  });
  
  createAccount.save();
  
  return UserHTTP.send({ status: 200, message: { text: 'Você recebeu um e-mail para verificar a sua conta.', color: 'green'  }}); 
}

exports.lockAccount = async (UserIP, AccountToken) => {
  const getAccount = await accountScheme.findOne({ Token: AccountToken });
  if (!getAccount) return;
  
  await accountScheme.findOneAndUpdate({ Token: AccountToken }, {
    isBlocked: UserIP
  });
}

exports.edit = async (UserIP, UserHTTP, Data) => {
  if (!Data.token) return UserHTTP.send({ status: 401 });
  const getAccount = await accountScheme.findOne({ Token: Data.token });
  if (!getAccount) return UserHTTP.send({ status: 401 });
  
  const actions = {
    "change_username": async () => {
          const newName = (Data.field_1).replaceAll(' ', '');
          const Password = Data.field_2;
          const ConfirmPassword = Data.field_3;
          
          if (typeof newName !== 'string') return UserHTTP.send({ status: 400, message: { text: 'Nome de usuário inválido.', color: 'red' }});
          if (!validator.isLength(newName, { min: 4, max: 16 })) return UserHTTP.send({ status: 400, message: { text: 'Nome muito curto ou muito grande.', color: 'red' }});
          if (!validator.matches(newName, /^[a-zA-Z0-9]+$/)) return UserHTTP.send({ status: 400, message: { text: 'Nome de usuário contém caracteres inválidos.', color: 'red' }});
        
          if (Password !== ConfirmPassword) return UserHTTP.send({ status: 400, message: { text: 'As senhas não batem.', color: 'red' }});
          
          const parsePassword = passwordCrypt(Password);
          if (parsePassword !== getAccount.Password) return UserHTTP.send({ status: 400, message: { text: 'Senha incorreta.', color: 'red' }});
          
          const alreadyExist = await accountScheme.findOne({ Username: newName });
          if (alreadyExist) return UserHTTP.send({ status: 400, message: { text: 'Já existe uma conta com esse nome.', color: 'red' }});
          
          await accountScheme.findOneAndUpdate({ Token: getAccount.Token }, {
            Username: newName.replaceAll(' ', '')
          });
          
          return UserHTTP.send({ status: 200 });
        },
    "change_password": async () => {
          const oldPassword = Data.field_1;
          const newPassword = Data.field_2;
          const ConfirmNewPassword = Data.field_3;
          
          if (passwordCrypt(oldPassword) !== getAccount.Password) return UserHTTP.send({ status: 400, message: { text: 'Senha antiga incorreta.', color: 'red' }});
          if (newPassword !== ConfirmNewPassword) return UserHTTP.send({ status: 400, message: { text: 'As senhas não batem.', color: 'red' }});
           
          if (typeof newPassword !== 'string') return UserHTTP.send({ status: 400, message: { text: 'Nova senha inválida.', color: 'red' }});
          if (newPassword.length < 8) return UserHTTP.send({ status: 400, message: { text: 'Senha muito curta.', color: 'red' }});
          if (newPassword.length > 32) return UserHTTP.send({ status: 400, message: { text: 'Senha muito longa.', color: 'red' }});
          
          const generateNewToken = crypto.randomBytes(32).toString('hex');
          
          await accountScheme.findOneAndUpdate({ ID: getAccount.ID }, {
            Token: generateNewToken,
            Password: passwordCrypt(newPassword)
          });
          
          return UserHTTP.send({ status: 200 });
        },
    "account_delete": async () => {
          const password = Data.field_1;
          const ConfirmPassword = Data.field_2;
          const ConfirmDelete = Data.field_3;
          
          if (password !== ConfirmPassword) return UserHTTP.send({ status: 400, message: { text: 'As senhas não batem.', color: 'red' }});
          
          const parsePassword = passwordCrypt(password);
          if (parsePassword !== getAccount.Password) return UserHTTP.send({ status: 400, message: { text: 'Senha incorreta.', color: 'red' }}); 
          
          if (!ConfirmDelete) return UserHTTP.send({ status: 400, message: { text: 'Escreva "deletar" no último campo para confirmar.', color: 'red' }});
          if (ConfirmDelete.toLowerCase() !== "deletar")  return UserHTTP.send({ status: 400, message: { text: 'Escreva "deletar" no último campo para confirmar.', color: 'red' }});
          
          const SaveID = getAccount.ID;
          await accountScheme.findOneAndUpdate({ ID: getAccount.ID }, {
            isBlocked: UserIP,
            accountDeleteIn: (Math.round(((Date.now() / 1000) / 60) + 2)).toString()
          })
          
          return UserHTTP.send({ status: 200 });
        }
  }
  
  try {
    actions[Data.action]();
  } catch (error) {
    return UserHTTP.send({ status: 400, message: { text: 'Ocorreu um erro, tente novamente mais tarde.', color: 'red' }});
  }
}

exports.emailVerification = async (UserIP, UserHTTP, Token) => {
  try {
    const getAccount = await accountScheme.findOne({ Email: Token });
    if (!getAccount) return UserHTTP.send(`<body onload="location.href='https://axonlab.glitch.me/account/invalid_token'"></body>`)
    
    function getEmailFromToken(Token, AccountID) {
      function decryptText(encryptedText, key) {
          const decipher = crypto.createDecipheriv('aes-256-ecb', Buffer.from(key, 'hex'), null); // Null IV
          let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
          decrypted += decipher.final('utf-8');
          return decrypted;
      }

      try {
          const recreateObject = decryptText(Token, AccountID);
          const parseObject = JSON.parse(recreateObject);
          return parseObject.email;
      } catch (err) {
          return 'invalid'
      }
    }
    
    const getEmail = getEmailFromToken(getAccount.Email, getAccount.ID);
    if (getEmail === 'invalid') return UserHTTP.send(`<body onload="location.href='https://axonlab.glitch.me/account/invalid_token'"></body>`)
    
    await accountScheme.findOneAndUpdate({ ID: getAccount.ID }, { Email: getEmail });
    this.subservices('create', getAccount.ID);
    
    return UserHTTP.send(`<body onload="location.href='https://axonlab.glitch.me/account/verified'"></body>`)
  } catch (error) {
    return UserHTTP.send(`<body onload="location.href='https://axonlab.glitch.me/account/invalid_token'"></body>`)
  }
}