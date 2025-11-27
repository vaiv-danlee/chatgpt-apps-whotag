module.exports = {
    apps: [
      {
        name: 'chatgpt-server',
        cwd: './server',
        script: 'pnpm',
        args: 'run dev',
        env: {
          NODE_ENV: 'development',
        },
        watch: false,
        autorestart: true,
        max_memory_restart: '1G',
      },
      {
        name: 'ngrok-tunnel',
        script: 'ngrok',
        args: 'http 3000',
        autorestart: true,
        watch: false,
      },
    ],
  };