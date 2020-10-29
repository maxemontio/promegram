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
  if (msg.data.split(',').length == 2) {
    createdBy = `${msg.from.first_name} ${msg.from.last_name}`
    ids = [msg.message.chat.id, msg.message.message_id]
    setSilence(msg.data, createdBy, ids)
  } 
  if (msg.data.split(',').length == 1) {
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
          { text: 'Set Silence', callback_data: returnData }
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
  var date = `${day}-${month + 1}-${year} ${hour}:${munites}`
  
  return date
}

function setSilence(data, createdBy, ids) {
  data = data.split(',')
  
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
  "startsAt": "2020-10-29T11:02:42.668Z",
  "endsAt": "2020-10-30T02:02:42.668Z",
  "createdBy": createdBy,
  "comment": "From Telegram bot"
})
  .then(function (response) {
    if (response.data){
      silencedButton(ids, response.data)
      console.log(`New silence set by ${createdBy}, id: ${response.data.silenceID}`);
    }
  })
  .catch(function (error) {
    console.log(error);
  });
}

function silenceDelete(silenceID, createdBy, ids) {
  axios.delete(`${alertmanagerUrl}/api/v2/silence/${silenceID}`)
  .then(function (response) {
    console.log(`Silence deleted by ${createdBy}, id: ${silenceID}`);
    simpleButton(ids)
  })
  .catch(function (error) {
    console.log(error.response.data);
  })
  .then(function () {
    // always executed
  });
}

function silencedButton(ids, silenceId) {
  opts = {
    chat_id: ids[0],
    message_id: ids[1],
  }
  changes =     {
    inline_keyboard: [
      [
        { text: `SilenceID: ${silenceId.silenceID}`, callback_data: `${silenceId.silenceID}` },
      ],
    ],
  }
  bot.editMessageReplyMarkup(changes, opts)
}

function simpleButton(ids) {
  opts = {
    chat_id: ids[0],
    message_id: ids[1],
  }
  changes =     {
    inline_keyboard: [
      [
        { text: 'Silence removed', callback_data: 'test,test,test' },
      ],
    ],
  }
  bot.editMessageReplyMarkup(changes, opts)
}

setInterval(function(){checkAlerts()}, 10000)

