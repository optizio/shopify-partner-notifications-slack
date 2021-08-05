const xminutely = require("../functions/events/scheduler/xminutely");

const getMockLibs = () => {
  return {
    kv: {
      get: jest.fn(),
      set: jest.fn(),
    },
    gqlClient: {
      request: jest.fn(),
    },
    slackClient: {
      messages: {
        create: jest.fn(),
      },
    },
  };
};

const getGqlResult = (nodes) => {
  return {
    app: {
      events: {
        edges: nodes,
        pageInfo: {
          hasNextPage: false,
        },
      },
    },
  };
};

const getNode = (type, myshopifyDomain) => {
  return {
    node: {
      type,
      shop: { myshopifyDomain },
    },
  };
};

describe("Shopify Partner Notifications Slack", () => {
  beforeEach(() => {
    Object.assign(process.env, {
      SHOPIFY_PARTNER_API_TOKEN: "prtapi_abc123",
      SLACK_CHANNEL: "#general",
      SHOPIFY_PARTNER_ID: "1234567",
      SHOPIFY_APP_ID: "4567890",
    });
  });

  test("errors when missing required env vars", async () => {
    delete process.env.SHOPIFY_PARTNER_API_TOKEN;
    await expect(xminutely()).rejects.toThrow();
  });

  test("sends events to slack", async () => {
    const { kv, gqlClient, slackClient } = getMockLibs();
    const result = getGqlResult([
      getNode("RELATIONSHIP_INSTALLED", "awesome-shop.myshopify.com"),
    ]);

    gqlClient.request.mockResolvedValue(result);
    kv.get.mockResolvedValue(new Date(Date.UTC(2021, 0, 1)).getTime());

    await xminutely.main(gqlClient, slackClient, kv);
    expect(slackClient.messages.create).toHaveBeenCalledTimes(1);
  });

  test("does not call slack when there are no events", async () => {
    const { kv, gqlClient, slackClient } = getMockLibs();
    const result = getGqlResult([]);

    gqlClient.request.mockResolvedValue(result);
    kv.get.mockResolvedValue(new Date(Date.UTC(2021, 0, 1)).getTime());

    await xminutely.main(gqlClient, slackClient, kv);
    expect(slackClient.messages.create).not.toHaveBeenCalled();
  });

  test("updates last retreived time on success", async () => {
    const { kv, gqlClient, slackClient } = getMockLibs();
    const result = getGqlResult([
      getNode("RELATIONSHIP_INSTALLED", "awesome-shop.myshopify.com"),
    ]);

    gqlClient.request.mockResolvedValue(result);
    kv.get.mockResolvedValue(new Date(Date.UTC(2021, 0, 1)).getTime());

    await xminutely.main(gqlClient, slackClient, kv);
    expect(kv.set.mock.calls[0][0].value).toEqual(
      gqlClient.request.mock.calls[0][1].end.getTime()
    );
  });

  test("does not update last retreived time on failure", async () => {
    const { kv, gqlClient, slackClient } = getMockLibs();

    gqlClient.request.mockRejectedValue(new Error("oh no!"));
    kv.get.mockResolvedValue(new Date(Date.UTC(2021, 0, 1)).getTime());

    await xminutely.main(gqlClient, slackClient, kv);
    expect(kv.set).not.toHaveBeenCalled();
  });
});
