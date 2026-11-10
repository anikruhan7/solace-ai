import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",
  aiApiKey: process.env.AI_API_KEY || "",
  aiBaseUrl: process.env.AI_BASE_URL || "https://api.groq.com/openai/v1",
  aiModel: process.env.AI_MODEL || "llama-3.3-70b-versatile",
  clientOrigin: process.env.CLIENT_ORIGIN || "*",
  expoPushUrl: process.env.EXPO_PUSH_URL || "https://exp.host/--/api/v2/push/send",
};