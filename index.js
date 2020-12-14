const express = require("express");
const bodyParser = require("body-parser");
const app = express();
app.use(bodyParser.json());
port = 8088;

checkConfig = require("./functions/check_config");
if (checkConfig.config() == false) {
  process.exit(1)
}

funcs = require("./functions/func.js");

require("dotenv").config();
checkIntervalS = process.env.CHECKINTERVALS
app.listen(port);
console.log(`Running on port: ${port}`);


ifButton = checkConfig.buttons();
bot = funcs.bot

allAlerts = [];
silencedMessages = [];

app.post("/", function (req, res) {
  funcs.root(req, res)
});

bot.on('message', (msg) => {
  funcs.getId(msg)
});

bot.onText(/\/users/, (msg) => {
  funcs.users(msg)
});

bot.on("callback_query", function (msg) {
  bot.answerCallbackQuery(msg.id);

  createdBy = `${msg.from.first_name} ${msg.from.last_name}`;
  ids = [msg.message.chat.id, msg.message.message_id];

  if (msg.data.split(",").length == 2) {
    funcs.setSilence(msg.data, createdBy, ids);
  }

  if (msg.data.split(",").length == 1 && msg.data != "nothing" && msg.data != "alrtmNotSet") {
    funcs.silenceDelete(msg.data, createdBy, ids);
  }
});

setInterval(function () {
  funcs.checkAlerts();
}, checkIntervalS * 1000);
