// Load and save per-client config files from ./clients.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const DIR = join(process.cwd(), "clients");

export async function loadClient(nameOrFile) {
  const file = nameOrFile.endsWith(".json") ? nameOrFile : `${nameOrFile}.json`;
  const raw = await readFile(join(DIR, file), "utf8");
  const data = JSON.parse(raw);
  data._file = file;
  return data;
}

export async function saveClient(client) {
  const { _file, ...rest } = client;
  await writeFile(join(DIR, _file), JSON.stringify(rest, null, 2) + "\n", "utf8");
}

export async function listClientFiles() {
  return (await readdir(DIR)).filter((f) => f.endsWith(".json"));
}
