import { Ajv2020, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import app from "../src/index";
import { env } from "./helpers";

// A fake URL the key ajv files the whole spec under so validators can
// $ref into it and internal #/components refs still resolve.
const DOC_ID = "https://bluelearn.test/openapi.json";
type JsonNode = Record<string, unknown>;
let specPromise: Promise<JsonNode> | undefined;

function loadSpec() {
  specPromise ??= (async () => {
    const res = await app.request("/openapi", {}, env);
    if (!res.ok) {
      throw new Error(
        `GET /openapi returned ${res.status}; the generated spec is unavailable.`
      );
    }
    const spec = (await res.json()) as JsonNode;
    ajv.addSchema(spec, DOC_ID);
    return spec;
  })();
  return specPromise;
}

const ajv = addFormats(
  new Ajv2020({ strict: false, allErrors: true, validateSchema: false })
);
const validators = new Map<string, ValidateFunction>();

const escape = (segment: string) =>
  segment.replace(/~/g, "~0").replace(/\//g, "~1");

function at(spec: JsonNode, pointer: string): unknown {
  let node: unknown = spec;
  for (const raw of pointer.split("/").slice(1)) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as JsonNode)[raw.replace(/~1/g, "/").replace(/~0/g, "~")];
  }
  return node;
}

function resolve(spec: JsonNode, pointer: string) {
  let node = at(spec, pointer);
  let hops = 0;
  while (
    node !== null &&
    typeof node === "object" &&
    typeof (node as JsonNode).$ref === "string" &&
    hops++ < 10
  ) {
    pointer = ((node as JsonNode).$ref as string).slice(1);
    node = at(spec, pointer);
  }
  return { node, pointer };
}

export async function expectToMatchSpec(
  res: Response,
  method: string,
  path: string
): Promise<void> {
  const spec = await loadSpec();

  const response = resolve(
    spec,
    `/paths/${escape(path)}/${method.toLowerCase()}/responses/${res.status}`
  );
  const schema = resolve(
    spec,
    `${response.pointer}/content/${escape("application/json")}/schema`
  );

  if (!schema.node) {
    throw new Error(
      `No application/json response schema in the generated OpenAPI spec for ` +
        `${method.toUpperCase()} ${path} -> ${res.status}. Either the route is ` +
        `missing a describeRoute entry for this case or it returned an ` +
        `undocumented status.`
    );
  }

  const key = `${method.toUpperCase()} ${path} ${res.status}`;
  let validate = validators.get(key);
  if (!validate) {
    validate = ajv.compile({ $ref: `${DOC_ID}#${schema.pointer}` });
    validators.set(key, validate);
  }

  const body = await res.clone().json();
  if (!validate(body)) {
    throw new Error(
      `Response body for ${key} violates the OpenAPI spec:\n` +
        ajv.errorsText(validate.errors, { separator: "\n" })
    );
  }
}
