import dotEnv from "dotenv";
import path from "path";
import cron from "node-cron";

import { syncElasticSearchEvents } from "./syncEvents";
import { syncElasticSearchNews } from "./syncNews";
import { syncElasticSearchBlogs } from "./syncBlogs";
import { syncLinkedEventsToDrupal } from "./linkedEventsSync";

dotEnv.config({ path: path.resolve(__dirname + "/../.env") });

const syncElasticEvents = async () => {
  console.log("------");
  console.log("start event sync", new Date());
  console.log("SYNC LINKED EVENTS");
  const modified = await syncLinkedEventsToDrupal();
  if (modified) {
    console.log("SYNC ELASTICSEARCH WITH DRUPAL EVENTS");
    await syncElasticSearchEvents();
  } else {
    console.log("SYNC ELASTICSEARCH WITH DRUPAL EVENTS nothing to do");
  }
};

const syncElasticContent = async () => {
  console.log("------");
  console.log("start content sync", new Date());
  console.log("SYNC NEWS");
  await syncElasticSearchNews();
  console.log("SYNC BLOGS");
  await syncElasticSearchBlogs();
};

syncElasticContent();
syncElasticEvents();

// Sync events every half an hour
cron.schedule("*/30 * * * *", async () => {
  syncElasticEvents();
});

// Sync content every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  syncElasticContent();
});
