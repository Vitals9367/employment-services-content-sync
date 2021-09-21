import { getClient } from "./elasticsearchClient";
import axios from "axios";

async function fetchDrupalEvents() {
  const drupalUrl = process.env.DRUPAL_URL;
  if (!drupalUrl) {
    throw "Set DRUPAL_URL";
  }
  const eventsDrupalUrl = drupalUrl + "/fi/apijson/node/event?include=field_page_content";
  const res = await axios.get(eventsDrupalUrl);

  const data = res.data;
  if (!data) {
    throw "Error fetcing drupal events, no data in res";
  }

  const eventData: Array<any> = data.data;
  if (!eventData) {
    throw "Error fetching drupal events, no event data in res";
  }

  const parsedEvents = eventData.reduce((acc: any, curr: any) => {
    const attr = curr.attributes;
    const event = {
      path: attr.path.alias,
      title: attr.field_title,
      image: attr.field_image_url,
      alt: attr.field_image_alt,
      text: attr.field_text?.value,
      startTime: attr.field_start_time,
      endTime: attr.field_end_time,
      location: attr.field_location,
    };
    return [...acc, event];
  }, []);

  return parsedEvents;
}

export const syncElasticSearchEvents = async () => {
  const client = getClient();
  try {
    await client.indices.delete({ index: "events" });
  } catch (err) {
    console.warn("WARNING when deleting 'events' index:");
  }

  try {
    await client.indices.create(
      {
        index: "events",
        body: {
          mappings: {
            properties: {
              path: { type: "text" },
              title: { type: "text" },
              image: { type: "text" },
              alt: { type: "text" },
              text: { type: "text" },
              startTime: { type: "date" },
              endTime: { type: "date" },
              location: { type: "text" },
            },
          },
        },
      },
      { ignore: [400] }
    );
  } catch (err) {
    console.log("ERROR", err);
    return;
  }

  try {
    const dataset = await fetchDrupalEvents();
    const body = dataset.flatMap((doc: any) => [{ index: { _index: "events" } }, doc]);
    const { body: bulkResponse } = await client.bulk({ refresh: true, body });
    const { body: count } = await client.count({ index: "events" });
    console.log("added:", count.count);
  } catch (err) {
    console.log("ERROR when adding events to index: ", err);
  }

};
