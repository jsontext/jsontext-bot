import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const ticketsFile = path.join(dir, "tickets.json");
const verifiedFile = path.join(dir, "verified.json");

function readJson(targetFile, fallback) {
  try {
    return JSON.parse(fs.readFileSync(targetFile, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(targetFile, data) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(targetFile, JSON.stringify(data, null, 2));
}

export function nextTicketNumber() {
  const data = readJson(ticketsFile, { counter: 0, tickets: {} });
  data.counter = (data.counter || 0) + 1;
  writeJson(ticketsFile, data);
  return data.counter;
}

export function addTicket(channelId, info) {
  const data = readJson(ticketsFile, { counter: 0, tickets: {} });
  data.tickets[channelId] = info;
  writeJson(ticketsFile, data);
}

export function getTicket(channelId) {
  return readJson(ticketsFile, { counter: 0, tickets: {} }).tickets[channelId] || null;
}

export function removeTicket(channelId) {
  const data = readJson(ticketsFile, { counter: 0, tickets: {} });
  delete data.tickets[channelId];
  writeJson(ticketsFile, data);
}

export function saveVerifiedUser(discordId, { robloxId, robloxUsername, verifiedAt }) {
  const data = readJson(verifiedFile, { users: {} });
  data.users[discordId] = {
    discordId,
    robloxId: String(robloxId),
    robloxUsername: robloxUsername || "",
    verifiedAt: verifiedAt || new Date().toISOString(),
  };
  writeJson(verifiedFile, data);
}

export function getVerifiedByDiscord(discordId) {
  const data = readJson(verifiedFile, { users: {} });
  return data.users[discordId] || null;
}

export function getVerifiedByRoblox(robloxId) {
  const target = String(robloxId).trim();
  const data = readJson(verifiedFile, { users: {} });
  return Object.values(data.users).find((entry) => entry.robloxId === target) || null;
}
