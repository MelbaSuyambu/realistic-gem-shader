const fs = require("fs");

const data = fs.readFileSync(process.argv[2]);

console.log("File Size:", data.length);