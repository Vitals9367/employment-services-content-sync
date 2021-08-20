import { Client } from "@elastic/elasticsearch";

export const getClient = (): Client => {
  const url = process.env.ELASTICSEARCH_URL;
  if (!url) throw "Set ELASTICSEARCH_URL";
  return new Client({ 
    node: url,
    auth: {
      username: "elastic",
      password: process.env.elasticsearch_password || "changeme",
    },
    ssl: {
      ca: process.env.elasticsearch_certificate,
      rejectUnauthorized: false,
    }
  });
}