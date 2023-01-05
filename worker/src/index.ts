/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { JSEncrypt } from "jsencrypt";

const BASE_URL = "https://telegra.ph/";
const BASE_TELE_API_URL = "https://api.telegra.ph/";

export interface Env {
  PRIVATE_KEY: string;
  TELEGRAPH_ACCESS_TOKEN: string;

  BURN_AFTER_READ_COUNT: number;
  READ_COUNT_KV: KVNamespace;

  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  // MY_KV_NAMESPACE: KVNamespace;
  //
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
  // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  // MY_BUCKET: R2Bucket;
}


function removeSensitiveText(text: string, keyword: string): string {
  return text.replaceAll(keyword, "snapgraph");
}

function decryptPath(pathname: string, private_key: string): boolean | string {
  const encrypt = new JSEncrypt();
  encrypt.setPrivateKey(private_key);

  return encrypt.decrypt(pathname);
}

function mockOkResponse(): Response {
  return new Response("ok", { status: 200 });
}

async function removePage(pathname: string, access_token: string): Promise<Response> {
  const body = {
    access_token: access_token,
    title: "Removed by Snapgraph",
    content: [{"tag": "p", "children": ["GitHub: [Snapgraph](https://github.com/tzwm/snapgraph)"]}],
    author_name: "Snapgraph",
    author_url: "https://github.com/tzwm/snapgraph",
  };
  const init = {
    body: JSON.stringify(body),
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  };

  return fetch(BASE_TELE_API_URL + "editPage/" + pathname, init);
}

async function updateReadCount(pathname: string, kv: KVNamespace): Promise<number> {
  const value = await kv.get(pathname);
  let count;
  if (value === null) {
    count = 1;
  } else {
    count = parseInt(value) + 1;
  }

  kv.put(pathname, count.toString());

  return count;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _: ExecutionContext
  ): Promise<Response> {
    if (request.method != "GET") {
      return mockOkResponse();
    }

    const { pathname } = new URL(request.url);
    const uncrypted_path = decryptPath(pathname.replace(/^\//, ""), env.PRIVATE_KEY);

    // decrypt failed
    if (typeof uncrypted_path != "string") {
      return fetch(BASE_URL + pathname);
    }

    const readCount = await updateReadCount(pathname, env.READ_COUNT_KV);
    if (readCount >= env.BURN_AFTER_READ_COUNT) {
      removePage(uncrypted_path, env.TELEGRAPH_ACCESS_TOKEN);
    }

    const response = await fetch(BASE_URL + uncrypted_path);
    const insensitive_body = removeSensitiveText(await response.text(), uncrypted_path);

    return new Response(insensitive_body, {
      headers: response.headers,
    });
  },
};
