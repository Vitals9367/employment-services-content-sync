import axios from "axios";
import { find } from 'lodash';
import { getClient } from "../elasticsearchClient";

export const getPagePath = (drupalSsrUrl: string, page: string, includes: string, filter = "") => {
  const api = "apijson";
  let rest = "/" + api + page + includes;
  if (filter) {
    rest += filter;
  }
  return [drupalSsrUrl + "/fi" + rest + "&filter[langcode]=fi", drupalSsrUrl + "/sv" + rest  + "&filter[langcode]=sv", drupalSsrUrl + rest  + "&filter[langcode]=en"];
};

const fetchWithPagination = async (drupalSsrUrl: string) => {
  const getRestOfData = async (data: any, filesUrl: any): Promise<any> => {
    const res = await axios.get(filesUrl.href);

    const combineData = [...res.data.data, ...data];

    const nextLink = res.data.links.next;
    if (nextLink) {
      return await getRestOfData(combineData, nextLink);
    }
    const newRes = { ...res, data: combineData };
    return newRes;
  };

  const res = await axios.get(drupalSsrUrl);

  const nextLink = res.data.links.next;
  if (nextLink) {
    const currDrupalData = res.data.data;

    const drupalData = await getRestOfData(currDrupalData, nextLink);
    return { ...res, data: drupalData };
  }
  return res;
};

export const findImageAlt = (item: any, field: string, files: any, media: any) => {
  if (!files || !files.data || !media || !media.data || !item.relationships[field].data) {
    return '';
  }
  const mIndex = media.data.data.findIndex((i: any) => i.id === item.relationships[field].data.id);
  const imgAlt = media.data.data[mIndex].relationships.field_media_image.data.meta.alt || '';

  return imgAlt;
}

export const findImage = (item: any, field: string, files: any, media: any, imageStyle: string) => {
  try {
    return findImageUrl(item.relationships[field].data.id, files, media, imageStyle);
  } catch (error) {
    // console.log('no pic: ' + field);
  }
  return null;
}

export const findImageUrl = (uuid: string, files: any, media: any, imageStyle: string) => {
  if (!files || !files.data || !media || !media.data) {
    return "";
  }
  const mIndex = media.data.data.findIndex((item: { id: string; }) => item.id === uuid);
  const imageUid = media.data.data[mIndex].relationships.field_media_image.data.id;
  const fIndex = files.data.data.findIndex((item: { id: string; }) => item.id === imageUid);

  let imageUrl = files.data.data[fIndex].attributes.image_style_uri.filter((imgStyle: { [x: string]: any; }) => imgStyle[imageStyle])[0][imageStyle];
  imageUrl = imageUrl.replace(process.env.DRUPAL_SSR_URL, process.env.DRUPAL_URL);
  
  return imageUrl;
}

export const findParagraphFieldData = (data: any, dataIncluded: any, paragraphField: string, paragraphType: string, field: string, files?: any, media?: any) => {
  try {
    const paragraph = find(data.relationships[paragraphField].data, { type: paragraphType });

    if (paragraph) {
      const paragraphData = find(dataIncluded, { id: paragraph.id });
      
      if (paragraphType === 'paragraph--image') {
        const imgData = {
          imageUrl: findImage(paragraphData, 'field_image_image', files, media, 'wide_s'),
          alt: findImageAlt(paragraphData, 'field_image_image', files, media)
        }
        return imgData;
      }

      return paragraphData.attributes[field];
    }
  } catch (error) {
    console.log(paragraphField);
    console.log(error);
  }
  return "";
}

export const findNodeData = (data: any, files: any, media: any) => {
  const nodeData: Array<any> = data.data;
  if (!nodeData) {
    throw "Error fetching drupal node data, no data in res";
  }

  const parsedData = nodeData.reduce((acc: any, node: any) => {
    const title = findParagraphFieldData(node, data.included, 'field_page_content', 'paragraph--mainheading', 'field_title');
    const { imageUrl, alt } = findParagraphFieldData(node, data.included, 'field_page_content', 'paragraph--image', 'field_image_image', files, media);
    const attr = node.attributes;

    const returnData = {
      id: node.id,
      path: attr.path.alias,
      date: attr.created,
      title,
      imageUrl: imageUrl || "https://edit.tyollisyyspalvelut.hel.fi/sites/default/files/2021-04/tyollisyyspalvelut-helsinki.png",
      alt: alt || '',
      summary: attr.field_summary,
    };
    return [...acc, returnData];
  }, []);

  return parsedData
}

export const fetchFiles = (drupalSsrUrl: string) => fetchWithPagination(drupalSsrUrl + "/apijson/file/file");
export const fetchImages = (drupalSsrUrl: string) => fetchWithPagination(drupalSsrUrl + "/apijson/media/image");

export const deleteIndex = async (name: string) => {
  const client = getClient();

  try {
    await client.indices.delete({ index: name });
  } catch (err) {
    console.warn(`WARNING when deleting ${name} index: ${err}`);
  }
}

export const createIndex = async (indexName: string, properties: any) => {
  const client = getClient();

  const newIndex = (name: string) => {
    return {
      index: name,
      body: {
        mappings: {
          properties
        },
      },
    }
  };

  try {
    await client.indices.create(newIndex(indexName), { ignore: [400] });
  } catch (err) {
    console.log(`WARNING when deleting ${indexName} index: ${err}`);
    return;
  }

}
