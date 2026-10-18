'use strict';

require('dotenv').config();
const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`\nAbbeyfield site running on http://localhost:${PORT}\n`);
});

// Stop cleanly on Ctrl+C (all platforms), Ctrl+Break (Windows) and SIGTERM (Docker and hosting platforms).
// Windows never sends SIGTERM, so registering it there is harmless.
function shutdown() {
  server.close(() => process.exit(0));
  server.closeIdleConnections(); // don't wait for browser keep-alive connections
  setTimeout(() => process.exit(0), 5000).unref();
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
  process.on(signal, shutdown);
}
