// server.js
// Entry point — connects to DB then starts listening

require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./config/db');

const PORT = process.env.PORT || 5000;

const start = async () => {
  // Verify DB connection before accepting any requests
  await testConnection();

  const server = app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   HIGH SCHOOL MANAGEMENT SYSTEM — API        ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║   Port    : ${PORT}                               ║`);
    console.log(`║   Env     : ${process.env.NODE_ENV}                     ║`);
    console.log(`║   Health  : http://localhost:${PORT}/api/health  ║`);
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
  });

  // Graceful shutdown on SIGTERM (Docker / cloud environments)
  process.on('SIGTERM', () => {
    console.log('SIGTERM received — shutting down gracefully...');
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  });
};

start().catch(err => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
