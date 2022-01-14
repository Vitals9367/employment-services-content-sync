import axios from "axios";
import urlSlug from "url-slug";
import { map, intersection } from "lodash";
import { getDrupalEvents } from "./helpers";

require("dotenv").config();

const linkedEventUrl = process.env.LINKEDEVENTS_URL || '';
const drupalEventUrl = process.env.DRUPAL_SSR_URL + "/apijson/node/event";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const allowedTags = ["Rekry", "Maahanmuuttajat", "Työhönohjaus", "etäosallistuminen", "työnhakijat"];

interface LinkedEventsItem {
  name: {
    fi: string;
  };
  id: string;
  location: {
    "@id": string;
    name:  {
      fi: string;
    };
  };
  images: [
    {
      alt_text: string;
      name: string;
      url: string;
    }
  ];
  in_language: {
    "@id": string;
  };
  "@id": string;
  publisher: string;
  short_description: {
    fi: string;
  };
  description: {
    fi: string;
  };
  start_time: string;
  end_time: string;
  last_modified_time: string;
  info_url: {
    fi: string;
  };
}

interface LinkedEventsLocation {
  name: {
    fi: string;
    sv: string;
    en: string;
  };
  street_address: null | {
    fi: string;
    sv: string;
    en: string;
  };
  address_locality: string;
}

interface DrupalEvent {
  type: "node--event";
  id: string;
  attributes: DrupalEventAttributes;
}

interface DrupalEventAttributes {
  title: string;
  field_id: string;
  field_image_name: string;
  field_image_url: string;
  field_image_alt: string;
  field_in_language: string;
  field_location: string;
  field_publisher: string;
  field_short_description: string;
  field_text: string;
  field_title: string;
  field_start_time: string;
  field_end_time: string;
  field_last_modified_time: string;
  field_info_url: string;
  path: {
    alias: string;
  };
  // TODO
  field_tags: any;
}

const userName = process.env.DRUPAL_API_LINKEDEVENTS_USER;
const password = process.env.DRUPAL_API_LINKEDEVENTS_PASS;
if (!userName || !password) {
  throw "Error: TODO";
}

const axiosConfig = {
  headers: {
    Accept: "application/vnd.api+json",
    "Content-type": "application/vnd.api+json",
  },
  auth: {
    username: userName,
    password: password,
  },
};

const getLinkedEvents = async (url: string): Promise<any> => {  
  const response = await axios.get(url);
  const data = response.data.data;

  if (response.data.meta.next !== null) {
    return data.concat(await getLinkedEvents(response.data.meta.next));
  } else {
    return data;
  }
}

const syncLinkedEventsToDrupal = async () => {
  if (!linkedEventUrl) {
    throw "Set LINKEDEVENTS_URL";
  }

  const linkedEvents = await getLinkedEvents(linkedEventUrl);
  const drupalEvents = await getDrupalEvents(drupalEventUrl);

  const existingDrupalEvents: { [id: string]: DrupalEvent } = {};
  drupalEvents.forEach((e: any) => {
    existingDrupalEvents[e.attributes.field_id] = e;
  });

  const tagUrls = new Set<string>();
  linkedEvents.map((e: any) => {
    e.keywords.map((key: any) => {
      tagUrls.add(key["@id"]);
    });
  });

  const tagPromises: any = [];

  tagUrls.forEach((key) => {
    tagPromises.push(axios.get(key));
  });

  const tags = await Promise.all(tagPromises);
  const linkedEventsData = linkedEvents.filter((linkedEvent: any) => linkedEvent.super_event_type !== 'recurring');

  let modified = true;
  const sync = async () => {
    for (const linkedEvent of linkedEventsData as Array<LinkedEventsItem>) {
      const currentDrupalEvent = existingDrupalEvents[linkedEvent.id];
      if (currentDrupalEvent) {
        const eventModified = currentDrupalEvent.attributes.field_last_modified_time !== linkedEvent.last_modified_time;
        const linkedEventTime = linkedEvent.end_time ? new Date(linkedEvent.end_time).setHours(0, 0, 0, 0) : new Date(linkedEvent.start_time).setHours(0, 0, 0, 0);
        const dateNow = new Date().setHours(0, 0, 0, 0);
        if (eventModified) {
          modified = true;
          await deleteDrupalEvent(currentDrupalEvent!.id);
          await addEventToDrupal(tags, linkedEvent);
          console.log(linkedEvent.id, "- modified and updated");
        } else if (dateNow > linkedEventTime) {
          modified = true;
          await deleteDrupalEvent(currentDrupalEvent!.id);
          console.log(linkedEvent.id, "- delete - event passed");
        } else {
          console.log(linkedEvent.id, "- exists");
        }
        delete existingDrupalEvents[linkedEvent.id];
      } else {
        const linkedEventTime = linkedEvent.end_time ? new Date(linkedEvent.end_time).setHours(0, 0, 0, 0) : new Date(linkedEvent.start_time).setHours(0, 0, 0, 0);
        const dateNow = new Date().setHours(0, 0, 0, 0);
        if (dateNow <= linkedEventTime) {
          modified = true;
          await addEventToDrupal(tags, linkedEvent);
        } else {
          console.log(linkedEvent.id, "- ignore: event passed");
        }
      }
    }
  };

  const deleteEvents = async () => {
    console.log("DELETE EVENTS");
    for (const eventId of Object.keys(existingDrupalEvents)) {
      modified = true;
      console.log(eventId, "- delete - not in LinkedEvents");
      const drupalEvent = existingDrupalEvents[eventId];
      deleteDrupalEvent(drupalEvent.id);
      await sleep(5000);
    }
  };

  await sync();
  await deleteEvents();
  return modified;
};

const linkedEventsToDrupalEventAttributes = (linkedEvent: LinkedEventsItem, tags: any): DrupalEventAttributes => {
  let tagNames = map(tags, "data.name.fi");
  tagNames = intersection(tagNames, allowedTags);
  let info_url = linkedEvent.info_url ? linkedEvent.info_url.fi : "";

  const drupalEvent: DrupalEventAttributes = {
    title: linkedEvent.name.fi,
    field_id: linkedEvent["id"],
    field_image_name: linkedEvent.images.length > 0 ? linkedEvent.images[0].name : "",
    field_image_url: linkedEvent.images.length > 0 ? linkedEvent.images[0].url : "",
    field_image_alt: linkedEvent.images.length > 0 ? linkedEvent.images[0].alt_text : "",
    field_in_language: linkedEvent.in_language["@id"],
    field_location: linkedEvent.location.name.fi,
    field_publisher: linkedEvent.publisher,
    field_short_description: linkedEvent.short_description.fi,
    field_text: linkedEvent.description.fi,
    field_title: linkedEvent.name.fi,
    field_start_time: linkedEvent.start_time,
    field_end_time: linkedEvent.end_time,
    field_last_modified_time: linkedEvent.last_modified_time,
    field_info_url: info_url.length > 255 ? '' : info_url,
    path: {
      alias: "/" + urlSlug(linkedEvent.name.fi),
    },
    field_tags: tagNames,
  };

  return drupalEvent;
};

const deleteDrupalEvent = async (id: string) => {
  try {
    const res = await axios.delete(drupalEventUrl + "/" + id, axiosConfig);
  } catch (err) {
    console.log("Event delete FAILED!!!", err);
  }
};

const addEventToDrupal = async (tags: any, linkedEvent: LinkedEventsItem) => {
  const drupalEvent = {
    data: {
      type: "node--event",
      attributes: linkedEventsToDrupalEventAttributes(linkedEvent, tags),
    },
  };

  try {
    await axios.post(drupalEventUrl, drupalEvent, axiosConfig);
  } catch (err) {
    console.log("Event add FAILED!!!", err);
  }
};

export { syncLinkedEventsToDrupal };
