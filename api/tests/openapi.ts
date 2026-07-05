import SwaggerParser from "@apidevtools/swagger-parser";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { fileURLToPath } from "node:url";

const specPath = fileURLToPath(
  new URL("../openapi/openapi.yaml", import.meta.url)
);

// Minimal view of the parts of the dereferenced spec this helper walks.
type JsonSchema = Record<string, unknown>;
type SpecDoc = {
  paths?: Record<
    string,
    Record<
      string,
      {
        responses?: Record<
          string,
          { content?: Record<string, { schema?: JsonSchema }> }
        >;
      }
    >
  >;
};

// Dereference once (inlines every $ref across paths/ and components/) and reuse.
let specPromise: Promise<SpecDoc> | undefined;
function loadSpec() {
  specPromise ??= SwaggerParser.dereference(specPath) as Promise<SpecDoc>;
  return specPromise;
}

// strict:false lets OpenAPI-only keywords (example, description) pass. Formats
// adds uuid/date-time so the common schemas validate.
const ajv = addFormats(new Ajv2020({ strict: false, allErrors: true }));
const validators = new Map<string, ValidateFunction>();

// Validate route responses against the hand-written OpenAPI spec so a handler
// that drifts from its declared contract fails a test.
export async function expectToMatchSpec(
  res: Response,
  method: string,
  path: string
): Promise<void> {
  const spec = await loadSpec();
  const operation = spec.paths?.[path]?.[method.toLowerCase()];
  const schema =
    operation?.responses?.[res.status]?.content?.["application/json"]?.schema;

  if (!schema) {
    throw new Error(
      `No application/json response schema in the OpenAPI spec for ` +
        `${method.toUpperCase()} ${path} -> ${res.status}. Either the spec is ` +
        `missing this case or the route returned an undocumented status.`
    );
  }

  const key = `${method.toUpperCase()} ${path} ${res.status}`;
  let validate = validators.get(key);
  if (!validate) {
    validate = ajv.compile(schema);
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
