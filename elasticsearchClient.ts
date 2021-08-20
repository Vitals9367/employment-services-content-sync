import { Client } from "@elastic/elasticsearch";

export const getClient = (): Client => {
  const url = process.env.ELASTICSEARCH_URL;
  if (!url) throw "Set ELASTICSEARCH_URL";
  return new Client({ 
    node: url,
    ssl: {
      // ca: fs.readFileSync('./cacert.pem'),
      rejectUnauthorized: false
    },
    // auth: {
    //   // @ts-expect-error
    //   apiKey: process.env.SECRET_KEY,
    // }
  });
}