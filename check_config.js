require('dotenv').config();

alertmanagerUrl = process.env.ALERTMANAGERURL
token = process.env.TOKEN
msgDelayMs = process.env.MSGDELAYMS
checkIntervalS = process.env.CHECKINTERVALS
silenceTime = process.env.SILENCETIME
users = process.env.USERS


module.exports.config = () => {
  if (typeof users == 'undefined'){
    console.log(`USERS are not set, exiting`)
    return false
  }
  if (typeof token == 'undefined'){
    console.log(`TOKEN is not set, exiting`)
    return false
  }
  if (typeof msgDelayMs == 'undefined'){
    console.log(`MSGDELAYMS is not set, exiting`)
    return false
  }
  if (typeof checkIntervalS == 'undefined'){
    console.log(`CHECKINTERVALS is not set, exiting`)
    return false
  }
}

module.exports.buttons = () => {
  if (silenceTime > 0 && typeof alertmanagerUrl != 'undefined'){
    console.log(`Alertmanager URL: ${alertmanagerUrl}`)
    return true
  } else {
    console.log(`Buttons disabled`)
    return false
  }
}



