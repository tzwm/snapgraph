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

const BASE_URL = "https://telegra.ph";

export interface Env {
  PRIVATE_KEY: string;
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

    if (typeof uncrypted_path == "string") { // decrypt success
      const response = await fetch(BASE_URL + "/" + uncrypted_path);
      const insensitive_body = removeSensitiveText(await response.text(), uncrypted_path);
      return new Response(insensitive_body, {
        headers: response.headers,
      });
    } else {
      return fetch(request);
    }
  },
};
