const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const src = path.join(__dirname, "../src/spend_icon.svg");
const outDir = path.join(__dirname, "../images");
const out = path.join(outDir, "spend_icon.png");

if (!fs.existsSync(src)) {
  console.error("src/spend_icon.svg not found");
  process.exit(1);
}

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

sharp(src)
  .resize(128, 128)
  .png()
  .toFile(out)
  .then(() => console.log("Icon built: images/spend_icon.png"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
