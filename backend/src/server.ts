import { createApp } from './app.js';
import { config } from './config.js';

createApp().listen(config.port, config.host, () => {
  console.info(`${new Date().toISOString()} local-ai-chat-api listening=http://${config.host}:${config.port} upstream=${config.llamaBaseUrl}`);
});
