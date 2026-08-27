module.exports = {
  apps: [
    {
      name: "botpanel",
      script: "src/server.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
      out_file: "storage/logs/pm2-out.log",
      error_file: "storage/logs/pm2-error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
