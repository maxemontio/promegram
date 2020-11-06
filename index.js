process.env.NTBA_FIX_319 = 1;
const TelegramBot = require('node-telegram-bot-api')
const express = require("express")
const bodyParser = require("body-parser")
const axios = require("axios")
const app = express()
require('dotenv').config();

alertmanagerUrl = process.env.ALERTMANAGERURL
token = process.env.TOKEN
chat_id = process.env.CHATID
// https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this
msgDelayMs = process.env.MSGDELAYMS // more than 1000 to group chat, more then 30 to single user chat but less than 20 messages per minute
checkIntervalS = process.env.CHECKINTERVALS // checkIntervalS * 1000 < msgDelayMs * max count of alerts you are recieving otherwise 429 errors
silenceTime = process.env.SILENCETIME
port = 8088


if (typeof chat_id == 'undefined'){
  console.log(`Chat id is not set, exiting`)
  process.exit(1);
}
if (typeof token == 'undefined'){
  console.log(`Bot Token is not set, exiting`)
  process.exit(1);
}
console.log(`Running on port: ${port}`)
if (typeof alertmanagerUrl !== 'undefined'){
  console.log(`Alertmanager URL: ${alertmanagerUrl}`)
} else {
  console.log(`Alertmanager URL is not set`)
}


app.listen(port)
app.use(bodyParser.json())

const bot = new TelegramBot(token, { polling: true })


allAlerts = []
silencedMessages = []

app.post("/", function (req, res) {
  res.sendStatus(200)
  req.body.alerts.forEach((element) => {
    allAlerts.push(element)
  })
})

bot.on("callback_query", function (msg) {
  bot.answerCallbackQuery(msg.id)

  createdBy = `${msg.from.first_name} ${msg.from.last_name}`
  ids = [msg.message.chat.id, msg.message.message_id]
  
  if (msg.data.split(',').length == 2) {
    setSilence(msg.data, createdBy, ids)
  } 
  
  if (msg.data.split(',').length == 1 && msg.data != "nothing" && msg.data != "alrtmNotSet") {
    silenceDelete(msg.data, createdBy, ids)
  }
})

async function checkAlerts() {
  if (allAlerts.length > 0){
    console.log(`Alerts recieved: ${allAlerts.length}`)
    for (const item of allAlerts) {
      await sendAlert(item);
    }
    allAlerts.length = 0
  }
  maxSavedSilences = 300
  if (silencedMessages.length > maxSavedSilences){
    dif = silencedMessages.length - maxSavedSilences
    silencedMessages.splice(0, dif);
  }
}

async function sendAlert(alert) {
  if (alert.status == "resolved"){
    text = `${alert.status.toUpperCase()}\n${alert.labels.alertname}\n\n${alert.annotations.summary}\n\n${parseTime(alert.endsAt)}`
  } else {
    text = `${alert.status.toUpperCase()}\n${alert.labels.alertname}\n\n${alert.annotations.summary}\n\n${parseTime(alert.startsAt)}`
  }

  returnData = [alert.labels.alertname,alert.labels.instance]
  returnData = returnData.toString()

  if (typeof alertmanagerUrl !== 'undefined'){
    buttText = `Set Silence for ${silenceTime}h`
    retData = returnData
  } else {
    buttText = 'Alertmanager URL not set'
    retData = 'alrtmNotSet'
  }
  options = {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [
          { text: buttText, callback_data: retData }
        ],
      ]
    })
  }
  bot.sendMessage(chat_id, text, options)
  return new Promise(resolve => setTimeout(resolve, msgDelayMs));
}

function parseTime(timeAt) {
  var rawDate = Date.parse(timeAt)
  var time = new Date(rawDate)
  var hour = time.getHours()
  var munites = time.getMinutes()
  var day = time.getDate()
  var month = time.getMonth() + 1
  var year = time.getFullYear()
  
  if (munites < 10){
    munites = `0${munites}`
  }
  if (day < 10){
    day = `0${day}`
  }
  if (month < 10){
    month = `0${month}`
  }
  if (hour < 10){
    hour = `0${hour}`
  }
  var date = `${day}-${month}-${year} ${hour}:${munites}`
  
  return date
}

function setSilence(data, createdBy, ids) {
  data = data.split(',')

  var CurrentTimeRaw = new Date();
  var startsAt = CurrentTimeRaw.toISOString()
  
  endsAtRaw = CurrentTimeRaw.setHours(CurrentTimeRaw.getHours() + silenceTime);
  endsAt = new Date(endsAtRaw).toISOString();  
  
  axios.post(`${alertmanagerUrl}/api/v2/silences`, {
    "matchers": [
        {
            "isRegex": false,
            "name": "alertname",
            "value": data[0]
        },
        {
            "isRegex": false,
            "name": "instance",
            "value": data[1]
        }
    ],
  "startsAt": startsAt,
  "endsAt": endsAt,
  "createdBy": createdBy,
  "comment": "From Telegram bot"
})
  .then(function (response) {
    if (response.data){
      silencedButton(ids, response.data)
      silencedMessages.push({"id":response.data.silenceID, "alert": data[0], "host": data[1]})
      console.log(`New silence set by ${createdBy}, id: ${response.data.silenceID}`);
    }
  })
  .catch(function (error) {
    console.log(error.message);
  });
}

function silenceDelete(data, createdBy, ids) {
  axios.delete(`${alertmanagerUrl}/api/v2/silence/${data}`)
  .then(function (response) {
    console.log(`Silence deleted by ${createdBy}, id: ${data}`);
    simpleButton(ids, data)

  })
  .catch(function (error) {
    var regexp = /already expired/gi;
    if (regexp.test(error.response.data)) {
      simpleButton(ids, data)
    } 
  })
}

function silencedButton(ids, silenceId) {
  opts = {
    chat_id: ids[0],
    message_id: ids[1],
  }
  changes =     {
    inline_keyboard: [
      [
        { text: `SilenceID: ${silenceId.silenceID}. Push to expire`, callback_data: silenceId.silenceID },
      ],
    ],
  }
  bot.editMessageReplyMarkup(changes, opts)
}

function simpleButton(ids, data) {
  index = silencedMessages.findIndex(alert => alert.id === data);
  if (index == -1){
    text = "Too old message"
    dataToReturn = "nothing"
  } else {
    text = `Set Silence for ${silenceTime}h`
    dataToReturn = [silencedMessages[index]["alert"], silencedMessages[index]["host"]]
    dataToReturn = dataToReturn.toString()  
  }

  changes =     {
    inline_keyboard: [
      [
        { text: text, callback_data: dataToReturn },
      ],
    ],
  }
  opts = {
    chat_id: ids[0],
    message_id: ids[1],
  }
  bot.editMessageReplyMarkup(changes, opts)
}

setInterval(function(){checkAlerts()}, checkIntervalS * 1000)


