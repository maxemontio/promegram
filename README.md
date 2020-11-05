# Promegram
Telegram notificator for Alertmanager

## Need to set
1. Bot token
2. Chat id
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
## Testing
Make a POST rquest to promegram to test alerting:
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