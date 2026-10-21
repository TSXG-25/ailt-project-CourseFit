import { createApp } from './app.js';

if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error('CourseFit needs Node.js 22 or later.');
  process.exit(1);
}
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be a whole number between 1 and 65535.');
  process.exit(1);
}
const server = await createApp();
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Set PORT in .env to another port and restart.` : `CourseFit could not start (${error.code || error.name}).`);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => console.log(`CourseFit is ready at http://127.0.0.1:${port}\nPress Ctrl+C to stop.`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
