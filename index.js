const TelegramBot = require('node-telegram-bot-api')
const express = require("express")
const bodyParser = require("body-parser")
const axios = require("axios")
const app = express()

app.listen(8088)
app.use(bodyParser.json())

alertmanagerUrl = ''
token = ''
chat_id = ''
silenceTime = 1

const bot = new TelegramBot(token, { polling: true })

allAlerts = []

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
  
  if (msg.data.split(',').length == 1 && msg.data != "nothing") {
    silenceDelete(msg.data, createdBy, ids)
  }
})

function checkAlerts() {
  if (allAlerts.length > 0){
    console.log(`Alerts recieved: ${allAlerts.length}`)
    while (allAlerts.length > 0){
        allAlerts.forEach(alert => {
          sendAlert(alert)
          allAlerts.splice(allAlerts.indexOf(alert), 1)
      })
    }
  }
}

function sendAlert(alert) {
  if (alert.status == "resolved"){
    text = `${alert.status.toUpperCase()}\n${alert.labels.alertname}\n\n${alert.annotations.summary}\n\n${parseTime(alert.endsAt)}`
  } else {
    text = `${alert.status.toUpperCase()}\n${alert.labels.alertname}\n\n${alert.annotations.summary}\n\n${parseTime(alert.startsAt)}`
  }

  returnData = [alert.labels.alertname,alert.labels.instance]
  returnData = returnData.toString()

  options = {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [
          { text: `Set Silence for ${silenceTime}h`, callback_data: returnData }
        ],
      ]
    })
  }
  bot.sendMessage(chat_id, text, options)
}

function parseTime(timeAt) {
  var rawDate = Date.parse(timeAt)
  var time = new Date(rawDate)
  var hour = time.getHours()
  var munites = time.getMinutes()
  var day = time.getDate()
  var month = time.getMonth()
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
  var date = `${day}-${month + 1}-${year} ${hour}:${munites}`
  
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
      silencedButton(ids, response.data, data)
      console.log(`New silence set by ${createdBy}, id: ${response.data.silenceID}`);
    }
  })
  .catch(function (error) {
    console.log(error);
  });
}

function silenceDelete(data, createdBy, ids) {
  data = data.split(',')

  axios.delete(`${alertmanagerUrl}/api/v2/silence/${data[0]}`)
  .then(function (response) {
    console.log(`Silence deleted by ${createdBy}, id: ${data[0]}`);
    data.splice(0,1)
    simpleButton(ids)
  })
  .catch(function (error) {
    var regexp = /already expired/gi;
    if (regexp.test(error.response.data)) {
      simpleButton(ids)
    } 
  })
}

function silencedButton(ids, silenceId, data) {

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

function simpleButton(ids) {
  changes =     {
    inline_keyboard: [
      [
        { text: "Silence deleted", callback_data: "nothing" },
      ],
    ],
  }
  opts = {
    chat_id: ids[0],
    message_id: ids[1],
  }
  bot.editMessageReplyMarkup(changes, opts)
}

setInterval(function(){checkAlerts()}, 10000)