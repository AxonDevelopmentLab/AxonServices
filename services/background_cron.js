const accountScheme = require("../database/account");
const accountServices = require('../services/account');

const crontask_interval = 120; //Minutos
setInterval(() => executeTasks(), (crontask_interval * 60 * 1000));

const currentTime = () => {
  return Math.round((Date.now() / 1000) / 60);
}
 
function executeTasks() {
  console.log('[CRON] Tasks executed!');
  accountScheme.find({}).then(async Array => {
    const PlansExpiresIn = Array.filter(item => item.PlanExpiresIn !== 'false').map(item => ({
      ID: item.ID,
      Time: item.PlanExpiresIn
    }));
    
    const accountDeleteIn = Array.filter(item => item.accountDeleteIn !== 'false').map(item => ({
      ID: item.ID,
      Time: item.accountDeleteIn
    }));

    for (const account of PlansExpiresIn) {
      if (currentTime() > Number(account.Time)) {
        await accountScheme.findOneAndUpdate({ ID: account.ID }, { Plan: 0, PlanExpiresIn: 'false' });
      }
    };
    
    for (const account of accountDeleteIn) {
      if (currentTime() > Number(account.Time)) {
        await accountScheme.findOneAndDelete({ ID: account.ID });
        accountServices.subservices('delete', account.ID);
      }
    }
  })
};