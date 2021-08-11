import { Client } from "@elastic/elasticsearch";

export const getClient = (): Client => {
  const url = process.env.ELASTICSEARCH_URL;
  if (!url) throw "Set ELASTICSEARCH_URL";
  return new Client({ 
    node: url,
    auth: {
      // @ts-expect-error
      bearer: process.env.SECRET_KEY,
    }
  });
}