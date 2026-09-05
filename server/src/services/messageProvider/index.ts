import { env } from "../../config/env";
import { MessageProvider } from "./types";
import { NoopProvider } from "./noopProvider";

let provider: MessageProvider;

switch (env.messageProvider) {
  case "noop":
  default:
    provider = new NoopProvider();
    break;
}

export { provider as messageProvider };
export * from "./types";
