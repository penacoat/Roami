import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";

// Placeholder so the backend builds and the emulator has something to run.
// Real handlers will go in backend/src/handlers/ and be exported from here.
export const healthCheck = onRequest((request, response) => {
  logger.info("healthCheck called");
  response.json({status: "ok"});
});