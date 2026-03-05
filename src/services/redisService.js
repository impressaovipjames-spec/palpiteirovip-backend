const { createClient } = require('redis');

class RedisService {
    constructor() {
        this.client = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });

        this.client.on('error', (err) => console.log('Redis Client Error', err));

        // Connect only if not already connected
        this.connect();
    }

    async connect() {
        if (!this.client.isOpen) {
            await this.client.connect();
            console.log('Redis connected successfully.');
        }
    }

    /**
     * Get a parsed JSON value from Redis
     */
    async get(key) {
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`Redis GET error on key ${key}:`, error);
            return null; // Fallback to fetching fresh data if Redis fails
        }
    }

    /**
     * Set a JSON value in Redis with a TTL in seconds
     */
    async set(key, value, ttlSeconds = 1800) {
        try {
            await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
        } catch (error) {
            console.error(`Redis SET error on key ${key}:`, error);
        }
    }

    /**
     * Delete a key
     */
    async del(key) {
        try {
            await this.client.del(key);
        } catch (error) {
            console.error(`Redis DEL error on key ${key}:`, error);
        }
    }
}

// Export a singleton instance
module.exports = new RedisService();
