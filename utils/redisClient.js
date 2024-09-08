const redis = require("redis");
const dotenv = require("dotenv");

dotenv.config();

const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (err) => {
  console.error("Redis error: ", err);
});

redisClient.on("ready", () => {
  console.log("Redis is ready");
});

redisClient.on("end", () => {
  console.log("Redis client disconnected");
});

(async () => {
  try {
    await redisClient.connect();
    console.log("Redis client connected");
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
  }
})();

module.exports = redisClient;
