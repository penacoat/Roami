import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [uid, action] = process.argv.slice(2);
const projectId = process.env.ROAMI_ADMIN_PROJECT_ID?.trim();

if (!uid || !["grant", "revoke"].includes(action) || !projectId) {
  throw new Error(
    "Usage: ROAMI_ADMIN_PROJECT_ID=<project> npm --prefix backend run set-catalog-editor -- <uid> <grant|revoke>",
  );
}

const isAuthEmulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
const app = initializeApp({
  projectId,
  ...(!isAuthEmulator && { credential: applicationDefault() }),
});
const auth = getAuth(app);
const user = await auth.getUser(uid);
const claims = { ...user.customClaims };

if (action === "grant") {
  claims.catalogEditor = true;
} else {
  delete claims.catalogEditor;
}

await auth.setCustomUserClaims(uid, claims);
console.log(
  `Catalog editor access ${action === "grant" ? "granted to" : "revoked from"} ${uid}.`,
);
