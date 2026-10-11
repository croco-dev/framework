import { productDatabasePath } from "../src/server/product/ProductTrials";
import { migrateProduct } from "../src/server/product/migrateProduct";

migrateProduct(productDatabasePath());
console.info("Product database migration complete.");
