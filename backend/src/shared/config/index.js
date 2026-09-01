function getRequiredEnv(key) {
	const value = process.env[key];
	if (!value) throw new Error(`Missing required environment variable: ${key}`);
	return value;
}

function getOptionalEnv(key, defaultValue) {
	return process.env[key] || defaultValue;
}

function appendTestSuffix(uri) {
	const questionMarkIndex = uri.indexOf("?");
	if (questionMarkIndex === -1) return `${uri}_test`;
	return `${uri.substring(0, questionMarkIndex)}_test${uri.substring(questionMarkIndex)}`;
}

let configInstance = null;

export function loadConfig(isTest = false) {
	const mongodbUri = getRequiredEnv("MONGODB_URI");
	configInstance = {
		mongodbUri: isTest ? appendTestSuffix(mongodbUri) : mongodbUri,
		jwtSecret: getRequiredEnv("JWT_SECRET"),
		jwtExpiresIn: getOptionalEnv("JWT_EXPIRES_IN", "24h"),
		port: parseInt(getOptionalEnv("PORT", "8000"), 10),
		nodeEnv: isTest ? "test" : getOptionalEnv("NODE_ENV", "development"),
	};
	return configInstance;
}

export function getConfig() {
	if (!configInstance) throw new Error("Configuration not loaded. Call initConfig() first after dotenv.config()");
	return configInstance;
}

export function initConfig() {
	configInstance = loadConfig();
	return configInstance;
}

export { getRequiredEnv, getOptionalEnv };
