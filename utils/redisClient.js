const redis = require("redis");
const dotenv = require("dotenv");

dotenv.config();

let redisClient = null;
let redisEnabled = false;

if (process.env.REDIS_URL) {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL,
  });

  redisClient.on("error", (err) => {
    console.error("Redis error: ", err);
    redisEnabled = false;
  });

  redisClient.on("ready", () => {
    console.log("Redis is ready");
    redisEnabled = true;
  });

  redisClient.on("end", () => {
    console.log("Redis client disconnected");
    redisEnabled = false;
  });

  (async () => {
    try {
      await redisClient.connect();
      console.log("Redis client connected");
      redisEnabled = true;
    } catch (error) {
      console.error("Failed to connect to Redis:", error);
      redisEnabled = false;
    }
  })();
} else {
  console.log("REDIS_URL not provided. Running without Redis caching.");
}

module.exports = { redisClient, redisEnabled };
