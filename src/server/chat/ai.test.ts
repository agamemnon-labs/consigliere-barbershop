import { describe, expect, it } from "vitest";
import { chatModels, modelUnavailable } from "./ai";

describe("chatModels", () => {
  it("reads a comma separated list in order", () => {
    expect(chatModels(" google/a , anthropic/b,, ")).toEqual(["google/a", "anthropic/b"]);
  });
});

describe("modelUnavailable", () => {
  it("moves on when the free tier may not use a model", () => {
    const error = Object.assign(new Error("Free tier users do not have access to this model."), {
      statusCode: 403,
    });
    expect(modelUnavailable(error)).toBe(true);
    expect(modelUnavailable({ statusCode: 404, message: "Model not found" })).toBe(true);
  });
  it("stops on a timeout or an outage, which the next model would hit too", () => {
    expect(modelUnavailable(new Error("The operation timed out"))).toBe(false);
    expect(modelUnavailable({ statusCode: 500, message: "Internal error" })).toBe(false);
  });
});
