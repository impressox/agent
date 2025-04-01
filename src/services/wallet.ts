import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { MongoClient } from "mongodb";
import crypto from "crypto";
import type { UserWallet } from "../types/index.js";
import NodeCache from "node-cache";
import type { IAgentRuntime } from "@elizaos/core";
import type { Address } from "viem";

// Convert hex string to Buffer and ensure it's 32 bytes (256 bits)
const getEncryptionKey = (): Buffer => {
    const key = process.env.ENCRYPTION_KEY || "05f1f51c9decc55769cdf10694f3373409a1f4545e6f72ddb2c01d51491f5b89";
    const keyBuffer = Buffer.from(key, 'hex');
    if (keyBuffer.length !== 32) {
        throw new Error("ENCRYPTION_KEY must be a 32-byte (256-bit) hex string");
    }
    return keyBuffer;
};

const IV_LENGTH = 16;

export class WalletService {
    private static instance: WalletService | null = null;
    private client: MongoClient;
    private dbName: string;
    private readonly COLLECTION_NAME = "wallets";
    private readonly CACHE_TTL = 3600; // 1 hour in seconds
    private cache: NodeCache;
    private encryptionKey: Buffer;

    private constructor() {
        const mongoUri = process.env.MONGO_URL;
        const dbName = process.env.MONGODB_DB_NAME;

        if (!mongoUri || !dbName) {
            throw new Error("MongoDB configuration is missing");
        }

        this.client = new MongoClient(mongoUri);
        this.dbName = dbName;
        this.cache = new NodeCache({ stdTTL: this.CACHE_TTL });
        this.encryptionKey = getEncryptionKey();
    }

    public static getInstance(): WalletService {
        if (!WalletService.instance) {
            WalletService.instance = new WalletService();
        }
        return WalletService.instance;
    }

    private getCacheKey(userId: string): string {
        return `wallet:${userId}`;
    }

    private getFromCache(userId: string): UserWallet | null {
        try {
            const cacheKey = this.getCacheKey(userId);
            return this.cache.get<UserWallet>(cacheKey) || null;
        } catch (error) {
            console.error("Error getting from cache:", error);
            return null;
        }
    }

    private setCache(userId: string, wallet: UserWallet): void {
        try {
            const cacheKey = this.getCacheKey(userId);
            this.cache.set(cacheKey, wallet);
        } catch (error) {
            console.error("Error setting cache:", error);
        }
    }

    private clearCache(userId: string): void {
        try {
            const cacheKey = this.getCacheKey(userId);
            this.cache.del(cacheKey);
        } catch (error) {
            console.error("Error clearing cache:", error);
        }
    }

    private encrypt(text: string): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv("aes-256-cbc", this.encryptionKey, iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString("hex") + ":" + encrypted.toString("hex");
    }

    private decrypt(text: string): string {
        const [ivHex, encryptedHex] = text.split(":");
        const iv = Buffer.from(ivHex, "hex");
        const encrypted = Buffer.from(encryptedHex, "hex");
        const decipher = crypto.createDecipheriv("aes-256-cbc", this.encryptionKey, iv);
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }

    async getOrCreateWallet(userId: string): Promise<UserWallet> {
        try {
            // Try to get from cache first
            const cachedWallet = this.getFromCache(userId);
            if (cachedWallet) {
                return cachedWallet;
            }

            // If not in cache, try to get from database
            const db = this.client.db(this.dbName);
            const collection = db.collection(this.COLLECTION_NAME);
            const existingWallet = await collection.findOne({ userId });

            if (existingWallet) {
                // Decrypt private key and ensure all required fields are present
                const decryptedWallet: UserWallet = {
                    userId: existingWallet.userId,
                    privateKey: this.decrypt(existingWallet.privateKey),
                    address: existingWallet.address,
                    createdAt: existingWallet.createdAt,
                    updatedAt: existingWallet.updatedAt
                };
                // Set in cache for next time
                this.setCache(userId, decryptedWallet);
                return decryptedWallet;
            }

            // Create new wallet if none exists
            const privateKey = generatePrivateKey();
            const account = privateKeyToAccount(privateKey);
            const wallet: UserWallet = {
                userId,
                privateKey,
                address: account.address,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Encrypt private key before saving
            const encryptedWallet = {
                ...wallet,
                privateKey: this.encrypt(privateKey)
            };

            // Save to database
            await collection.insertOne(encryptedWallet);

            // Set in cache
            this.setCache(userId, wallet);

            return wallet;
        } catch (error) {
            console.error("Error in getOrCreateWallet:", error);
            throw error;
        }
    }

    async updateWallet(userId: string, updates: Partial<UserWallet>): Promise<void> {
        try {
            const db = this.client.db(this.dbName);
            const collection = db.collection(this.COLLECTION_NAME);

            // If updating private key, encrypt it
            if (updates.privateKey) {
                updates.privateKey = this.encrypt(updates.privateKey);
            }

            await collection.updateOne(
                { userId },
                { 
                    $set: { 
                        ...updates,
                        updatedAt: new Date()
                    }
                }
            );

            // Clear cache after update
            this.clearCache(userId);
        } catch (error) {
            console.error("Error in updateWallet:", error);
            throw error;
        }
    }

    async deleteWallet(userId: string): Promise<void> {
        try {
            const db = this.client.db(this.dbName);
            const collection = db.collection(this.COLLECTION_NAME);
            await collection.deleteOne({ userId });

            // Clear cache after deletion
            this.clearCache(userId);
        } catch (error) {
            console.error("Error in deleteWallet:", error);
            throw error;
        }
    }

    async close(): Promise<void> {
        try {
            await this.client.close();
        } catch (error) {
            console.error("Error closing MongoDB connection:", error);
            throw error;
        }
    }

    static async getOrCreateUserWallet(
        userId: string,
        runtime: IAgentRuntime
    ): Promise<{ privateKey: string; address: Address }> {
        const walletService = WalletService.getInstance();
        const wallet = await walletService.getOrCreateWallet(userId);
        return {
            privateKey: wallet.privateKey,
            address: wallet.address,
        };
    }
} 