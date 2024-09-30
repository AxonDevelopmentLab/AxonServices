const statisticsScheme = require("../database/instalock");
const accountScheme = require("../database/account");
const axios = require('axios');

exports.run = async (UserIP, UserHTTP, ID, Code) => {  
    try {
      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: '1274868905554481277',
            client_secret: process.env.Discord_Secret,
            grant_type: 'authorization_code',
            code: Code,
            redirect_uri: 'https://axonlab.glitch.me/popupauth?redirectTo=https://axon-services.glitch.me/connect_discord&passContent=id,code'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }});

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokenResponse.data.access_token}`
            }
        });

        const AxonID = ID;
        const DiscordID = userResponse.data.id;
      
        const getAccount = await accountScheme.findOne({ ID: AxonID });
        if (!getAccount) return UserHTTP.send(`<body onload="location.href='https://axonlab.glitch.me/'"></body>`)
      
        if (getAccount.Connections && getAccount.Connections.Discord && getAccount.Connections.Discord.ID === DiscordID) return UserHTTP.send(`<script>alert('Você já vinculou esse Discord a sua conta.')</script><body onload="location.href='https://axonlab.glitch.me/account/dashboard'"></body>`)
      
        const findAlreadyDiscord = await accountScheme.findOne({ "Connections.Discord.ID": DiscordID });
        if (findAlreadyDiscord) return UserHTTP.send(`<script>alert('Você não pode vincular um Discord em duas contas diferentes.')</script><body onload="location.href='https://axonlab.glitch.me/account/dashboard'"></body>`)
      
        if (!getAccount.Connections || getAccount.Connections && !getAccount.Connections.Discord) {
          const getStatistics = await statisticsScheme.findOne({ ID: getAccount.ID });
          await statisticsScheme.findOneAndUpdate({ ID: getAccount.ID }, {
            FreePicks: getStatistics.FreePicks + 10
          });
        };
      
        UserHTTP.send(`<script>alert('A sua conta foi vinculada com o seu Discord com sucesso! As recompensas por vincular a sua conta foram creditadas na sua conta da AxonLab.')</script><body onload="location.href='https://axonlab.glitch.me/discord'"></body>`)
        await accountScheme.findOneAndUpdate({ ID: AxonID }, { $set: { 'Connections.Discord': { "Username": userResponse.data.username, "ID": DiscordID } } });
    } catch (error) {
      return UserHTTP.send(`<script>alert('Oops! Ocorreu um erro ao vincular a sua conta, clique em "Ok" para ser enviado para o nosso servidor de suporte, solicite ajuda no Servidor para solucionar o seu problema.')</script><body onload="location.href='https://axonlab.glitch.me/discord'"></body>`)
    }
};