import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const file = path.join(dir, "tickets.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { counter: 0, tickets: {} };
  }
}

function save(data) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function nextTicketNumber() {
  const data = load();
  data.counter = (data.counter || 0) + 1;
  save(data);
  return data.counter;
}

export function addTicket(channelId, info) {
  const data = load();
  data.tickets[channelId] = info;
  save(data);
}

export function getTicket(channelId) {
  return load().tickets[channelId] || null;
}

export function removeTicket(channelId) {
  const data = load();
  delete data.tickets[channelId];
  save(data);
}
