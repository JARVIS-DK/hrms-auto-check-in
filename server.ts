import "dotenv/config";
import { createServer } from "http";
import next from "next";
import { initCronJobs } from "./src/cron";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res);
  }).listen(port, () => {
    console.log(`> Server listening on http://localhost:${port}`);
    initCronJobs();
  });
});
