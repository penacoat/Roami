import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { requireFirestoreEmulatorHost, runSeed } from "../src/scripts/seed";

jest.mock("firebase-admin/app", () => ({
  initializeApp: jest.fn(),
}));
jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(),
}));

describe("seed emulator safety", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires emulator configuration and never initializes Firebase without it", async () => {
    await expect(runSeed({})).rejects.toThrow(
      "FIRESTORE_EMULATOR_HOST is not set",
    );
    expect(initializeApp).not.toHaveBeenCalled();
    expect(getFirestore).not.toHaveBeenCalled();
  });

  it("reports an unavailable emulator connection without falling back to production", async () => {
    jest.mocked(getFirestore).mockImplementation(() => {
      throw new Error("ECONNREFUSED");
    });

    await expect(
      runSeed({ FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" }),
    ).rejects.toThrow(
      "Could not seed the Firestore emulator at 127.0.0.1:8080. Confirm the emulator is running and reachable",
    );
    expect(initializeApp).toHaveBeenCalledWith({ projectId: "roami-7c0bd" });
  });

  it.each([
    "firestore.example.com:8080",
    "192.168.1.25:8080",
    "127.0.0.1:8081",
  ])("rejects non-local or unexpected emulator host %s", (host) => {
    expect(() =>
      requireFirestoreEmulatorHost({ FIRESTORE_EMULATOR_HOST: host }),
    ).toThrow("Only the local Firestore emulator on port 8080 is supported");
  });

  it.each(["127.0.0.1:8080", "localhost:8080", "[::1]:8080"])(
    "allows local emulator host %s",
    (host) => {
      expect(
        requireFirestoreEmulatorHost({ FIRESTORE_EMULATOR_HOST: host }),
      ).toBe(host);
    },
  );
});
