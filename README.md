# Shopify Partner Event Notifications in Slack

[<img src="https://open.autocode.com/static/images/open.svg?" width="192">](https://open.autocode.com/)

This Autocode app will send notifications to Slack when merchants install and subscribe to your app (as well as when they uninstall and unsubscribe). It does this by polling the partner events API (every 5 minutes by default), and then sends a notification to Slack for each relevant event.

![Slack Notifications](/readme/slack_messages.png)

## How it works

We poll the Shipify Partner API's GraphQL endpoint requesting several relationship (install, uninstall, deactivated, reactivated) and subscription (activated, canceled, frozen, unfrozen) events*.

We then loop through the events returned since the last request and post a message to Slack for each one.

A note of the last success is also recorded in Autocode's key/value store so that if you get a transient failure, then the next run will pick up any missed events.

* We don't get all event types. Some aren't particularly useful, or can be too noisy.

## Environment Variables

- `SHOPIFY_PARTNER_API_TOKEN`: Shopify Partner API access token, generated from Settings > Partner API Clients > Manage Partner API Clients in the Partner Portal.
- `SLACK_CHANNEL`: The channel name to post Slack names to, e.g. #general
- `SHOPIFY_PARTNER_ID`: Your Shopify Partner ID. Can be found under Settings > Account Information > Partner ID in the Partner Portal.
- `SHOPIFY_APP_ID`: Your Shopify App's ID. Can be found toward the end of the url when on the App's main page in the Partner Portal.
