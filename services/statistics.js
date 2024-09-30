const accountScheme = require("../database/account");
const security = require("../background/security.js");
const statisticsScheme = require("../database/instalock");

exports.instalock = async (UserIP, RequestData, UserHTTP) => {
  if (!RequestData.token) return UserHTTP.send({ status: 400 });
  if (!RequestData.service) return UserHTTP.send({ status: 400 });
  
  const secureEnviroment = security.check(RequestData.security);
  if (secureEnviroment) return UserHTTP.send({ status: 401 });
  
  const getAccount = await accountScheme.findOne({ Token: RequestData.token });
  if (!getAccount) return UserHTTP.send({ status: 204 });
  if (getAccount.isBlocked !== 'false') return UserHTTP.send({ status: 401 });
  let getStatistics = await statisticsScheme.findOne({ ID: getAccount.ID });
  
  let usablePicks = getStatistics.FreePicks;
  if (getAccount.Plan !== 0) usablePicks = -1;
  
  try {
    const services = {
      "sum_matches": async () => {
        if (usablePicks === 0) return UserHTTP.send({ status: 204 });
        if (usablePicks !== -1) { getStatistics.FreePicks = (getStatistics.FreePicks - 1); usablePicks = usablePicks - 1; };
        getStatistics.TotalMatches++;
        
        await statisticsScheme.findOneAndUpdate({ ID: getAccount.ID }, {
          FreePicks: getStatistics.FreePicks,
          TotalMatches: getStatistics.TotalMatches
        });
        
        const recreateStatistics = {
          free_picks: usablePicks,
          matches: {
            sucess: getStatistics.SucessfullyMatches,
            failed: getStatistics.TotalMatches - getStatistics.SucessfullyMatches
          },
          agents: getStatistics.Agents
        }
        
        return UserHTTP.send({ status: 200, statistics: recreateStatistics })
      },
      "sum_agents": async () => {
        if (!RequestData.content) return UserHTTP.send({ status: 400 });
        const findAgent = getStatistics.Agents.find(callback => callback.name === RequestData.content);
        if (findAgent) { findAgent.times++ } else { getStatistics.Agents.push({ name: RequestData.content, times: 1 })};
          
        getStatistics.SucessfullyMatches++;
        
        await statisticsScheme.findOneAndUpdate({ ID: getAccount.ID }, {
          SucessfullyMatches: getStatistics.SucessfullyMatches,
          Agents: getStatistics.Agents
        });
        
        const recreateStatistics = {
          free_picks: usablePicks,
          matches: {
            sucess: getStatistics.SucessfullyMatches,
            failed: getStatistics.TotalMatches - getStatistics.SucessfullyMatches
          },
          agents: getStatistics.Agents
        }
        
        return UserHTTP.send({ status: 200, statistics: recreateStatistics })
      }
    };
    
    services[RequestData.service]();
  } catch (err) {
    return UserHTTP.send({ status: 400 });
  }
}