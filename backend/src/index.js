import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./shared/config/database.js";
import { config } from "./shared/config/index.js";

await connectDatabase();
const server = createApp().listen(config.port, "0.0.0.0", () => console.log(`Calendar API listening on ${config.port}`));

async function shutdown(signal) {
    console.log(`${signal} received; closing Calendar API.`);
    server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
    });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
