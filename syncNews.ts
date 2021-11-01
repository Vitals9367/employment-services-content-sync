import axios from "axios";
import { getClient } from "./elasticsearchClient";
import { fetchFiles, fetchImages, getPagePath, findNodeData } from './helpers';
import { NodeData } from "./types";

async function fetchNews() {
  const drupalSsrUrl = process.env.DRUPAL_SSR_URL;
  if (!drupalSsrUrl) {
    throw "Set DRUPAL_SSR_URL";
  }

  const [fiNewsUrl, svNewsUrl, enNewsUrl] = getPagePath(
    drupalSsrUrl,
    "/node/news",
    "?include=field_page_content",
  );

  const [fi, sv, en, files, media] = await Promise.all([axios.get(fiNewsUrl), axios.get(svNewsUrl), axios.get(enNewsUrl), fetchFiles(drupalSsrUrl), fetchImages(drupalSsrUrl)]);

  const data = fi.data;
  if (!data) {
    throw "Error fetcing drupal news, no data in res";
  }

  const nodeData: NodeData = {
    fi: findNodeData(fi.data, files, media),
    en: findNodeData(en.data, files, media),
    sv: findNodeData(sv.data, files, media),
  };

  return nodeData;
}

export const syncElasticSearchNews = async () => {
  const client = getClient();

  try {
    await Promise.all([await client.indices.delete({ index: "news-fi" }), await client.indices.delete({ index: "news-sv" }), await client.indices.delete({ index: "news-en" })]);
  } catch (err) {
    console.warn("WARNING when deleting 'news' index: " + err);
  }

  const newIndex = (name: string) => {
    return {
      index: name,
      body: {
        mappings: {
          properties: {
            id: { type: 'text' },
            path: { type: "text" },
            date: { type: "date" },
            title: { type: "text" },
            imageUrl: { type: "text" },
            alt: { type: "text" },
            summary: { type: "text" },
          },
        },
      },
    }
  };

  try {
    await Promise.all([client.indices.create(newIndex('news-fi'),{ ignore: [400] }), client.indices.create(newIndex('news-sv'),{ ignore: [400] }), client.indices.create(newIndex('news-en'),{ ignore: [400] })]);
  } catch (err) {
    console.log("ERROR when creating index: ", err);
    return;
  }

  try {
    const news = await fetchNews();
    const dataset = Object.keys(news).map((k: any) => {
      return news[k].flatMap((doc: any) => [{ index: { _index: "news-" + k } }, doc]);
    });
  
    const body = dataset.flatMap((doc: any) => doc);
    const { body: bulkResponse } = await client.bulk({ refresh: true, body });
    const [{ body: fiBody }, { body: svBody }, { body: enBody }] = await Promise.all([client.count({ index: "news-fi" }), client.count({ index: "news-sv" }), client.count({ index: "news-en" })]);
    console.log("news-fi added:", fiBody.count);
    console.log("news-sv added:", svBody.count);
    console.log("news-en added:", enBody.count);
  } catch (err) {
    console.warn("WARNING when adding news to index: " + err);
  }

};
