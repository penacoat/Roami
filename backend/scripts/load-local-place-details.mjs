/** Imports reviewed website snapshots into the local emulator; never fetches live hours.
 * Re-run after the demo seed. Only these catalog fields change; saves/trips stay intact.
 */
import { readFile } from "node:fs/promises";

const records = JSON.parse(
  await readFile(
    new URL("./local-place-details.json", import.meta.url),
    "utf8",
  ),
);
// Deliberately fixed to loopback. No credentials, metadata lookup, or production target.
const base =
  "http://127.0.0.1:8080/v1/projects/roami-7c0bd/databases/(default)/documents/places";
const headers = {
  Authorization: "Bearer owner",
  "Content-Type": "application/json",
};
const request = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok)
    throw new Error(`Local emulator returned ${response.status}`);
  return response.json();
};
for (const [id, values] of Object.entries(records)) {
  const url = `${base}/${encodeURIComponent(id)}`;
  const existing = await request(url);
  const fields = {};
  for (const [key, value] of Object.entries(values)) {
    fields[key] =
      typeof value === "string"
        ? { stringValue: value }
        : {
            mapValue: {
              fields: Object.fromEntries(
                Object.entries(value).map(([k, v]) => [k, { stringValue: v }]),
              ),
            },
          };
  }
  fields.missingFields = {
    arrayValue: {
      values: (existing.fields.missingFields?.arrayValue?.values ?? []).filter(
        (item) => !(item.stringValue in values),
      ),
    },
  };
  const query = new URLSearchParams(
    Object.keys(fields).map((key) => ["updateMask.fieldPaths", key]),
  );
  await request(`${url}?${query}`, {
    method: "PATCH",
    body: JSON.stringify({ fields }),
  });
  console.log(
    `Loaded website details for ${id} (checked ${values.openingHoursSource.checkedAt})`,
  );
}
