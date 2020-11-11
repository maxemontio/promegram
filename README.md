# Promegram
Telegram notificator for Alertmanager

## Need to set
1. Bot token
2. Chat id (one or more)
3. Alertmanager URL

## Features
1. Sending alerts by one
2. Button, which allows you to set silence (by instance and alertname values) and expire it then
3. No need to type /start or something to launch, it will send messages to set chat until it is alive

## Alertmanager config
```yaml
receivers:
  - name: 'promegram'
    webhook_configs:
    - send_resolved: true
      url: <url:port>
```
If you have multiple recievers, do not set 'group_by' directive for promegram - bot works faster without that

## Prometheus rules
Promegram use summary field, so use it for some kind of message templating.

Example: 
```yaml
- alert: HostIsDown
  expr: up == 0
  labels:
    severity: warning
  annotations:
    summary: 
      "Job: {{ $labels.job }}
      \nHost: {{ $labels.instance }}
      \nMessage: Host is unavailable
      \nMetric value: {{ $value }}"
```

## Try with docker
```yaml
version: '3.1'

services:
  promegram:
    image: maxemontio/promegram:latest
    container_name: promegram
    hostname: promegram
    restart: always 
    ports:
      - 8088:8088
    environment:
      - ALERTMANAGERURL=http://<address>:<port>
      - TOKEN=<bot token> # botfather will tell you
      - USERS=<chat id> # one or more user or group chat ids, but it is better to use ony user chat ids because of https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this
      - SILENCETIME=1 # minimum one hour
      - MSGDELAYMS=2000 # more than 1000 to GROUP chat and LESS than 20 messages per minute, more then 30 to SINGLE USER chat
      - CHECKINTERVALS=120 # checkIntervalS * 1000 < msgDelayMs * max count of alerts you are recieving, otherwise 429 errors
```
SILENCETIME - for how many hours silence will be set. Minimum value is 1.

## Testing
Make a POST request to promegram to test alerting:
```json
{
   "status":"firing",
   "alerts":[
      {
         "status":"firing",
         "labels":{
            "alertname":"testPromegram",
            "instance":"testPromegram:9100",
            "job":"testPromegram",
            "severity":"warning"
         },
         "annotations":{
            "summary":"Job: testPromegram \nHost: testPromegram:9100 \nMessage: Test message \nMetric value: 1"
         },
         "startsAt":"1970-01-01T10:00:00.000000000Z",
         "endsAt":"0001-01-01T00:00:00Z"
      }
   ]
}
```