process.env.NTBA_FIX_319 = 1;
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
require("dotenv").config();

alertmanagerUrl = process.env.ALERTMANAGERURL
token = process.env.TOKEN
msgDelayMs = process.env.MSGDELAYMS
checkIntervalS = process.env.CHECKINTERVALS
silenceTime = process.env.SILENCETIME
users = process.env.USERS
users = users.split(",");
port = 8088;
module.exports.bot = new TelegramBot(token, { polling: true });

module.exports.root = (req, res) => {
  res.sendStatus(200);
  req.body.alerts.forEach((element) => {
    allAlerts.push(element);
  });
}

module.exports.getId = (msg) => {
  if (msg.forward_from){
    text = `id: ${msg.forward_from.id}\nfirst_name: ${msg.forward_from.first_name}\nlast_name: ${msg.forward_from.last_name}`
    bot.sendMessage(msg.chat.id, text);
  }
}

module.exports.users = (msg) => {
  text = `Total users: ${users.length}\n${users.toString()}`
  bot.sendMessage(msg.chat.id, text);
}

module.exports.checkAlerts = async () => {
  if (allAlerts.length > 0) {
    console.log(`Alerts recieved: ${allAlerts.length}`);
    for (userId of users) {
      for (const alert of allAlerts) {
        await sendAlert(alert, userId);
      }
    }
    allAlerts.length = 0;
  }
  maxSavedSilences = 300;
  if (silencedMessages.length > maxSavedSilences) {
    dif = silencedMessages.length - maxSavedSilences;
    silencedMessages.splice(0, dif);
  }
}

getDuration = (startTime, endTime) => {
  durationTimeraw = (endTime - startTime) / 1000;

  days = Math.trunc(durationTimeraw / 60 / 60 / 24);

  if (days >= 0) {
    hours = Math.trunc(durationTimeraw / 60 / 60 - days * 24);
  }

  if (days >= 0 && hours >= 0) {
    mins = Math.trunc(durationTimeraw / 60 - days * 24 * 60 - hours * 60);
  }

  if (days >= 0 && hours >= 0 && mins >= 0) {
    secs = Math.trunc(durationTimeraw - days * 24 * 60 * 60 - hours * 60 * 60 - mins * 60);
  }

  durTime = `${days}d, ${hours}h, ${mins}m, ${secs}s`;
  return durTime;
}

sendAlert = async (alert, userId) => {
  if (alert.status == "resolved") {
    start = Date.parse(alert.startsAt);
    end = Date.parse(alert.endsAt);
    text = `✅✅✅<b><u> ${alert.status.toUpperCase()}</u> ✅✅✅\n${alert.labels.alertname}</b>\n\n${alert.annotations.summary}\n\n${parseTime(alert.startsAt)}\nDuration: ${getDuration(start, end)}`;
  } else {
    start = Date.parse(alert.startsAt);
    end = Date.now();
    text = `🔥🔥🔥<b><u> ${alert.status.toUpperCase()}</u> 🔥🔥🔥\n${alert.labels.alertname}</b>\n\n${alert.annotations.summary}\n\n${parseTime(alert.startsAt)}\n${getDuration(start, end)} ago`;
  }

  returnData = [alert.labels.alertname, alert.labels.instance];
  returnData = returnData.toString();

  if (typeof alertmanagerUrl != "undefined") {
    buttText = `Set Silence for ${Math.trunc(silenceTime)}h`;
    retData = returnData;
  } else {
    buttText = "Alertmanager URL not set";
    retData = "alrtmNotSet";
  }
  options = {
    parse_mode: "HTML",
    reply_markup: JSON.stringify({
      inline_keyboard: [[{ text: buttText, callback_data: retData }]]
    }),
  };

  if (ifButton == true) {
    if (Buffer.byteLength(returnData) > 64) {
      console.log(
        `overload: ${returnData} - ${Buffer.byteLength(returnData)} bytes of 64. Hostname or Alertname is too long.`);
      bot.sendMessage(userId, text);
    } else {
      bot.sendMessage(userId, text, options);
    }
  } else {
    bot.sendMessage(userId, text);
  }
  return new Promise((resolve) => setTimeout(resolve, msgDelayMs));
}

function parseTime(timeAt) {
  var rawDate = Date.parse(timeAt);
  var time = new Date(rawDate);
  var hour = time.getHours();
  var munites = time.getMinutes();
  var day = time.getDate();
  var month = time.getMonth() + 1;
  var year = time.getFullYear();

  if (munites < 10) {
    munites = `0${munites}`;
  }
  if (day < 10) {
    day = `0${day}`;
  }
  if (month < 10) {
    month = `0${month}`;
  }
  if (hour < 10) {
    hour = `0${hour}`;
  }
  var date = `${day}-${month}-${year} ${hour}:${munites}`;

  return date;
}

module.exports.setSilence = (data, createdBy, ids) => {
  data = data.split(",");

  silenceTime = Number(silenceTime);

  var CurrentTimeRaw = new Date();
  var startsAt = CurrentTimeRaw.toISOString();

  endsAtRaw = CurrentTimeRaw.setHours(CurrentTimeRaw.getHours() + silenceTime);
  endsAt = new Date(endsAtRaw).toISOString();

  axios
    .post(`${alertmanagerUrl}/api/v2/silences`, {
      matchers: [
        {
          isRegex: false,
          name: "alertname",
          value: data[0],
        },
        {
          isRegex: false,
          name: "instance",
          value: data[1],
        },
      ],
      startsAt: startsAt,
      endsAt: endsAt,
      createdBy: createdBy,
      comment: "From Telegram bot",
    })
    .then(function (response) {
      if (response.data) {
        silencedButton(ids, response.data);
        silencedMessages.push({
          id: response.data.silenceID,
          alert: data[0],
          host: data[1],
        });
        console.log(
          `New silence set by ${createdBy}, id: ${response.data.silenceID}`
        );
      }
    })
    .catch(function (error) {
      console.log(error.message);
    });
}

module.exports.silenceDelete = (data, createdBy, ids) => {
  axios
    .delete(`${alertmanagerUrl}/api/v2/silence/${data}`)
    .then(function (response) {
      console.log(`Silence deleted by ${createdBy}, id: ${data}`);
      simpleButton(ids, data);
    })
    .catch(function (error) {
      var regexp = /already expired/gi;
      if (regexp.test(error.response.data)) {
        simpleButton(ids, data);
      }
    });
}

function silencedButton(ids, silenceId) {
  opts = {
    chat_id: ids[0],
    message_id: ids[1],
  };
  changes = {
    inline_keyboard: [
      [
        {
          text: `SilenceID: ${silenceId.silenceID}. Push to expire`,
          callback_data: silenceId.silenceID,
        },
      ],
    ],
  };
  bot.editMessageReplyMarkup(changes, opts);
}

function simpleButton(ids, data) {
  index = silencedMessages.findIndex((alert) => alert.id === data);
  if (index == -1) {
    text = "Too old message";
    dataToReturn = "nothing";
  } else {
    text = `Set Silence for ${Math.trunc(silenceTime)}h`;
    dataToReturn = [
      silencedMessages[index]["alert"],
      silencedMessages[index]["host"],
    ];
    dataToReturn = dataToReturn.toString();
  }

  changes = {
    inline_keyboard: [[{ text: text, callback_data: dataToReturn }]],
  };
  opts = {
    chat_id: ids[0],
    message_id: ids[1],
  };
  bot.editMessageReplyMarkup(changes, opts);
}
