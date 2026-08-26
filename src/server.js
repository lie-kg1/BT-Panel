const app = require("../app");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

if (require.main === module) {
  app.listen(PORT, HOST, () => console.log(`BT PANEL running at http://localhost:${PORT}`));
}

module.exports = app;
