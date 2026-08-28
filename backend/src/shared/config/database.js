import mongoose from "mongoose";
import { config } from "./index.js";

export async function connectDatabase(uri = config.mongoUri) {
    await mongoose.connect(uri);
}

export async function disconnectDatabase() {
    await mongoose.disconnect();
}
