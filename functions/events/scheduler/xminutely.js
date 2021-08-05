const lib = require("lib")({ token: process.env.STDLIB_SECRET_TOKEN });
const { GraphQLClient, gql } = require("graphql-request");

const query = gql`
  query (
    $start: DateTime!
    $end: DateTime!
    $after: String
    $first: Int!
    $appid: ID!
  ) {
    app(id: $appid) {
      id
      name
      events(
        types: [
          SUBSCRIPTION_CHARGE_ACTIVATED
          SUBSCRIPTION_CHARGE_CANCELED
          SUBSCRIPTION_CHARGE_FROZEN
          SUBSCRIPTION_CHARGE_UNFROZEN
          RELATIONSHIP_INSTALLED
          RELATIONSHIP_DEACTIVATED
          RELATIONSHIP_REACTIVATED
          RELATIONSHIP_UNINSTALLED
        ]
        occurredAtMin: $start
        occurredAtMax: $end
        first: $first
        after: $after
      ) {
        pageInfo {
          hasNextPage
        }
        edges {
          cursor
          node {
            type
            shop {
              myshopifyDomain
            }
          }
        }
      }
    }
  }
`;

const eventMessageMappings = {
  SUBSCRIPTION_CHARGE_ACTIVATED: "has subscribed! :tada:",
  SUBSCRIPTION_CHARGE_CANCELED: "has cancelled their subscription :tired_face:",
  SUBSCRIPTION_CHARGE_FROZEN: "has been frozen :cold_face:",
  SUBSCRIPTION_CHARGE_UNFROZEN: "has unfrozen! :relieved:",
  RELATIONSHIP_INSTALLED: "has installed! :star-struck:",
  RELATIONSHIP_DEACTIVATED: "has deactivated :worried:",
  RELATIONSHIP_REACTIVATED: "has reactivated! :relaxed:",
  RELATIONSHIP_UNINSTALLED: "has uninstalled :cry:",
};

const checkEnv = () => {
  let error = false;
  if (!process.env.SHOPIFY_PARTNER_API_TOKEN) {
    console.error("SHOPIFY_PARTNER_API_TOKEN env var not set");
    error = true;
  }
  if (!process.env.SHOPIFY_PARTNER_ID) {
    console.error("SHOPIFY_PARTNER_ID env var not set");
    error = true;
  }
  if (!process.env.SHOPIFY_APP_ID) {
    console.error("SHOPIFY_APP_ID env var not set");
    error = true;
  }
  if (!process.env.SLACK_CHANNEL) {
    console.error("SLACK_CHANNEL env var not set");
    error = true;
  }
  if (error) throw new Error("Required env vars not set, see logs.");
};

const processEvents = async (slackClient, events) => {
  for (let event of events) {
    console.log(event);
    await slackClient.messages.create({
      channel: process.env.SLACK_CHANNEL,
      text: `${event.node.shop.myshopifyDomain} ${
        eventMessageMappings[event.node.type]
      }`,
    });
  }
};

module.exports = async () => {
  checkEnv();

  const graphqlClient = new GraphQLClient(
    `https://partners.shopify.com/${process.env.SHOPIFY_PARTNER_ID}/api/2021-07/graphql.json`,
    {
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_PARTNER_API_TOKEN,
      },
    }
  );

  return module.exports.main(
    graphqlClient,
    lib.slack.channels["@0.7.3"],
    lib.utils.kv["@0.1.16"]
  );
};

module.exports.main = async (graphqlClient, slackClient, kv) => {
  const lastRetrieved = await kv.get({
    key: `spns_${process.env.NODE_ENV}_last_retrieved`,
    defaultValue: Date.now(),
  });
  console.log(`Requesting since ${new Date(parseInt(lastRetrieved))}`);

  const endDate = Date.now();

  try {
    const data = await graphqlClient.request(query, {
      start: new Date(parseInt(lastRetrieved)),
      end: new Date(endDate),
      after: null,
      first: 100,
      appid: `gid://partners/App/${process.env.SHOPIFY_APP_ID}`,
    });

    if (data.app.events.pageInfo.hasNextPage) {
      console.warn(
        `Too many event to process, consider running more frequenty`
      ); // could paginate, but firing >100 events off at once is probably too many already
    }

    await processEvents(slackClient, data.app.events.edges);
  } catch (e) {
    console.error(e);
    return "error requesting data from Shopify";
  }

  await kv.set({
    key: `spns_${process.env.NODE_ENV}_last_retrieved`,
    value: endDate,
  });

  return "ok";
};
