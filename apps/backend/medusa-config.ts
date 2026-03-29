import {
  ContainerRegistrationKeys,
  Modules,
  defineConfig,
  loadEnv,
} from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd())

export default defineConfig({
  plugins: ["medusa-plugin-razorpay-v2"],
  admin: {
    // disable: process.env.NODE_ENV === "production" ? false : true,
    vite: () => {
      let hmrServer;
      if (process.env.HMR_BIND_HOST) {
        const { createServer } = require("http");
        hmrServer = createServer();
        const hmrPort = parseInt(process.env.HMR_PORT || "9001");
        hmrServer.listen(hmrPort, process.env.HMR_BIND_HOST);
      }

      let allowedHosts;
      if (process.env.__MEDUSA_ADDITIONAL_ALLOWED_HOSTS) {
        allowedHosts = [process.env.__MEDUSA_ADDITIONAL_ALLOWED_HOSTS];
      }

      return {
        server: {
          allowedHosts,
          hmr: {
            server: hmrServer,
          },
        },
      };
    },
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseDriverOptions: {
      // Neon requires SSL for all connections
      connection: { ssl: { rejectUnauthorized: false } },
      // Neon serverless Postgres kills idle connections after ~5 minutes.
      // These pool settings prevent "Connection ended unexpectedly" errors.
      pool: {
        min: 0,
        max: 10,
        idleTimeoutMillis: 30_000,       // close idle connections after 30s (before Neon's 5min cutoff)
        acquireTimeoutMillis: 60_000,    // wait up to 60s for a connection from pool
        reapIntervalMillis: 1_000,       // check for idle connections every 1s
      },
    },
    databaseLogging: false,
    redisUrl: process.env.REDIS_URL || undefined,
    // ↑ Set REDIS_URL only when Redis is actually running (local dev: comment out in .env)
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET!,
      cookieSecret: process.env.COOKIE_SECRET!,
    },
  },
  modules: {
    payment: {
      resolve: "@medusajs/medusa/payment",
      dependencies: [Modules.PAYMENT, ContainerRegistrationKeys.LOGGER],
      options: {
        providers: [
          ...((process.env.RAZORPAY_TEST_KEY_ID || process.env.RAZORPAY_KEY_ID)
            ? [{
                resolve: "./src/providers/payment-razorpay",
                id: "razorpay",
                options: {
                  key_id: process.env.RAZORPAY_TEST_KEY_ID ?? process.env.RAZORPAY_KEY_ID,
                  key_secret: process.env.RAZORPAY_TEST_KEY_SECRET ?? process.env.RAZORPAY_KEY_SECRET,
                  razorpay_account: process.env.RAZORPAY_ACCOUNT ?? "",
                  automatic_expiry_period: 30,
                  manual_expiry_period: 20,
                  refund_speed: "normal",
                  webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
                },
              }]
            : []),
        ],
      },
    },
    pharmaCore: { resolve: "./src/modules/pharma" },
    pharmaPrescription: { resolve: "./src/modules/prescription" },
    pharmaInventoryBatch: { resolve: "./src/modules/inventoryBatch" },
    pharmaRbac: { resolve: "./src/modules/rbac" },
    pharmaDispense: { resolve: "./src/modules/dispense" },
    pharmaOrder: { resolve: "./src/modules/orders" },
    pharmaCod: { resolve: "./src/modules/cod" },
    pharmaWarehouse: { resolve: "./src/modules/warehouse" },
    pharmaShipment: { resolve: "./src/modules/shipment" },
    pharmaPayment: { resolve: "./src/modules/payment" },
    pharmaCompliance: { resolve: "./src/modules/compliance" },
    pharmaCrm: { resolve: "./src/modules/crm" },
    pharmaAnalytics: { resolve: "./src/modules/analytics" },
    pharmaLoyalty: { resolve: "./src/modules/loyalty" },
    pharmaWishlist: { resolve: "./src/modules/wishlist" },
    pharmaNotification: { resolve: "./src/modules/notification" },
    fulfillment: {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/fulfillment-manual",
            id: "manual",
          },
          {
            resolve: "./src/providers/fulfillment-conditional",
            id: "conditional-shipping",
          },
        ],
      },
    },
    notification: {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "./src/providers/notification-resend",
            id: "resend",
            options: {
              channels: ["email"],
              api_key: process.env.RESEND_API_KEY,
              from: process.env.RESEND_FROM_EMAIL || "Suprameds <support@supracynpharma.com>",
            },
          },
        ],
      },
    },
    file: {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          ...(process.env.R2_FILE_URL
            ? [
                {
                  id: "s3",
                  resolve: "@medusajs/medusa/file-s3",
                  is_default: true,
                  options: {
                    file_url: process.env.R2_FILE_URL,
                    prefix: process.env.R2_PREFIX,
                    bucket: process.env.R2_BUCKET,
                    endpoint: process.env.R2_ENDPOINT,
                    access_key_id: process.env.R2_ACCESS_KEY_ID,
                    secret_access_key: process.env.R2_SECRET_ACCESS_KEY,
                    session_token: process.env.R2_SESSION_TOKEN,
                    region: "auto",
                    additional_client_config: {
                      forcePathStyle: false,
                      requestChecksumCalculation: "WHEN_REQUIRED",
                    },
                  },
                },
              ]
            : process.env.S3_REGION
              ? [
                  {
                    id: "s3",
                    resolve: "@medusajs/medusa/file-s3",
                    is_default: true,
                    options: {
                      file_url: process.env.S3_FILE_URL,
                      prefix: process.env.S3_PREFIX,
                      bucket: process.env.S3_BUCKET,
                      endpoint: process.env.S3_ENDPOINT,
                      access_key_id: process.env.S3_ACCESS_KEY_ID,
                      secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
                      region: process.env.S3_REGION,
                      additional_client_config: {
                        forcePathStyle: true,
                      },
                    },
                  },
                ]
              : [
                  {
                    id: "local",
                    resolve: "@medusajs/medusa/file-local",
                    is_default: true,
                    options: {
                      upload_dir: "uploads",
                      backend_url: `http://localhost:${process.env.PORT || 9000}`,
                    },
                  },
                ]),
        ],
      },
    },
  },
})
